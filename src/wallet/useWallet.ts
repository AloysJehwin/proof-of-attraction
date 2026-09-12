import { useEffect } from 'react';
import { usePrivy, useEmbeddedEthereumWallet } from '@privy-io/expo';
import { createWalletClient, custom, parseEther } from 'viem';
import { worldChainSepolia, TOPUP_ADDRESS, TOPUP_ETH } from './chain';
import { WALLET_ENABLED } from './provider';
import { registerSigner, TopUpResult } from './topup';

export type WalletState = {
  enabled: boolean;
  ready: boolean;
  address: string | null;
};

function useWalletEnabled(): WalletState {
  const { user, isReady } = usePrivy();
  const { wallets, create } = useEmbeddedEthereumWallet();
  const wallet = wallets?.[0] ?? null;

  useEffect(() => {
    if (!isReady || !user) return;
    if (!wallet) create?.().catch(() => undefined);
  }, [isReady, user, wallet, create]);

  useEffect(() => {
    if (!wallet) {
      registerSigner(null);
      return;
    }
    registerSigner(async (): Promise<TopUpResult> => {
      try {
        const provider = await wallet.getProvider();
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
        return { ok: false, error: e instanceof Error ? e.message : 'signing failed' };
      }
    });
  }, [wallet]);

  return { enabled: true, ready: Boolean(isReady && wallet), address: wallet?.address ?? null };
}

function useWalletDisabled(): WalletState {
  return { enabled: false, ready: false, address: null };
}

export const useWallet: () => WalletState = WALLET_ENABLED ? useWalletEnabled : useWalletDisabled;
