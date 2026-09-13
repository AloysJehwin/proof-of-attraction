import { useEffect, useRef } from 'react';
import { useWallet } from './useWallet';
import { useAuth } from '../auth/AuthContext';
import { useApp } from '../lib/store';
import { saveWallet } from '../api';

/**
 * Provisions the Privy embedded wallet and links it to the signed-in account as
 * soon as it is ready, rather than waiting for the user to open the Agent tab.
 *
 * The backend needs this address to:
 *   - score on-chain reputation in discovery ranking (`reputationSignals`)
 *   - map wallet -> humanId so agent quota follows the human, not the device
 *
 * Calls `useWallet()` internally, so mounting this hook is enough to kick off
 * wallet provisioning and signer registration.
 */
export function useWalletSync(): void {
  const { address } = useWallet();
  const { status, me, refresh } = useAuth();
  const { agent, updateAgent } = useApp();

  const inFlight = useRef<string | null>(null);
  const failed = useRef<Set<string>>(new Set());

  const linked = me?.user?.wallet ?? null;
  const tier = me?.user?.tier ?? null;
  const agentWallet = agent.walletAddress;
  const agentRegistered = agent.registered;

  useEffect(() => {
    if (!address || status !== 'signed-in') return;
    // POST /me/wallet is Orb-gated server-side; don't bother before then.
    if (tier !== 'orb') return;

    const next = address.toLowerCase();

    // Server already has this wallet: mirror it into agent state, don't re-post.
    if (linked && linked.toLowerCase() === next) {
      if (!agentRegistered || agentWallet?.toLowerCase() !== next) {
        updateAgent({ registered: true, walletAddress: address });
      }
      return;
    }

    if (inFlight.current === next || failed.current.has(next)) return;
    inFlight.current = next;

    (async () => {
      try {
        await saveWallet(address);
        updateAgent({ registered: true, walletAddress: address });
        await refresh();
      } catch {
        // Don't loop on failure; the Agent tab exposes a manual re-link button
        // and this retries on the next app start.
        failed.current.add(next);
      } finally {
        inFlight.current = null;
      }
    })();
  }, [address, status, tier, linked, agentRegistered, agentWallet, updateAgent, refresh]);
}

