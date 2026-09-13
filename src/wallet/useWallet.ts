import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { usePrivy, useEmbeddedEthereumWallet, useCreateGuestAccount } from '@privy-io/expo';
import { createPublicClient, createWalletClient, custom, formatEther, http, parseEther } from 'viem';
import { worldChainSepolia, TOPUP_ADDRESS, TOPUP_ETH } from './chain';
import { WALLET_ENABLED } from './provider';
import { registerSigner, registerMessageSigner, TopUpResult } from './topup';

export type WalletState = {
  enabled: boolean;
  ready: boolean;
  busy: boolean;
  address: string | null;
  error: string | null;
  retry: () => void;
};

type Provision = { busy: boolean; error: string | null };

let provision: Provision = { busy: false, error: null };
const listeners = new Set<() => void>();

function setProvision(patch: Partial<Provision>) {
  provision = { ...provision, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function describe(e: unknown): string {
  if (e instanceof Error) {
    const extra = (e as { code?: string; status?: number }).code ?? (e as { status?: number }).status;
    return extra ? `${e.message} (${extra})` : e.message;
  }
  return String(e);
}

function shortError(e: unknown): string {
  if (e && typeof e === 'object' && 'shortMessage' in e && typeof (e as { shortMessage: unknown }).shortMessage === 'string') {
    return (e as { shortMessage: string }).shortMessage;
  }
  return e instanceof Error ? e.message.split('\n')[0] : 'signing failed';
}

function useWalletEnabled(): WalletState {
  const { user, isReady, error: initError } = usePrivy();
  const { wallets, create } = useEmbeddedEthereumWallet();
  const { create: createGuest } = useCreateGuestAccount();
  const state = useSyncExternalStore(subscribe, () => provision);
  const wallet = wallets?.[0] ?? null;

  const run = useCallback(async () => {
    if (provision.busy) return;
    setProvision({ busy: true, error: null });
    try {
      if (!user) await createGuest();
      else if (!wallet) await create();
    } catch (e) {
      setProvision({ error: describe(e) });
    } finally {
      setProvision({ busy: false });
    }
  }, [user, wallet, create, createGuest]);

  useEffect(() => {
    if (!isReady || wallet || provision.error) return;
    run();
  }, [isReady, user, wallet, run]);

  const retry = useCallback(() => {
    setProvision({ error: null });
    run();
  }, [run]);

  useEffect(() => {
    if (!wallet) {
      registerSigner(null);
      registerMessageSigner(null);
      return;
    }
    registerSigner(async (): Promise<TopUpResult> => {
      try {
        const address = wallet.address as `0x${string}`;
        const balance = await createPublicClient({ chain: worldChainSepolia, transport: http() }).getBalance({ address });
        if (balance < parseEther(TOPUP_ETH)) {
          return {
            ok: false,
            error: `Wallet has ${formatEther(balance)} ETH on World Chain Sepolia. Send at least ${TOPUP_ETH} ETH plus gas to ${address} from the faucet, then retry.`,
          };
        }
        const provider = await wallet.getProvider();
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${worldChainSepolia.id.toString(16)}` }],
        });
        const client = createWalletClient({
          account: wallet.address as `0x${string}`,
          chain: worldChainSepolia,
          transport: custom(provider),
        });
        const hash = await client.sendTransaction({
          to: TOPUP_ADDRESS as `0x${string}`,
          value: parseEther(TOPUP_ETH),
          chain: worldChainSepolia,
          account: wallet.address as `0x${string}`,
        });
        return { ok: true, hash };
      } catch (e) {
        return { ok: false, error: shortError(e) };
      }
    });
    registerMessageSigner(async (message: string): Promise<string> => {
      const provider = await wallet.getProvider();
      const client = createWalletClient({
        account: wallet.address as `0x${string}`,
        chain: worldChainSepolia,
        transport: custom(provider),
      });
      return client.signMessage({ account: wallet.address as `0x${string}`, message });
    });
  }, [wallet]);

  const error = initError ? `Privy init failed: ${initError.message}` : state.error;

  return {
    enabled: true,
    ready: Boolean(isReady && wallet),
    busy: !isReady || state.busy,
    address: wallet?.address ?? null,
    error,
    retry,
  };
}

function useWalletDisabled(): WalletState {
  return { enabled: false, ready: false, busy: false, address: null, error: null, retry: () => undefined };
}

export const useWallet: () => WalletState = WALLET_ENABLED ? useWalletEnabled : useWalletDisabled;

function useWalletLogoutEnabled(): () => Promise<void> {
  const { logout } = usePrivy();
  return async () => {
    await logout().catch(() => undefined);
    setProvision({ busy: false, error: null });
  };
}

function useWalletLogoutDisabled(): () => Promise<void> {
  return async () => undefined;
}

export const useWalletLogout: () => () => Promise<void> = WALLET_ENABLED ? useWalletLogoutEnabled : useWalletLogoutDisabled;
