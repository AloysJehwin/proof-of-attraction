import { parseEther } from 'viem';
import { publicClient } from './payments.js';
import { lookupHuman } from './agentkit.js';
import type { OnchainSignals } from './matching.js';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BALANCE_BANDS = [parseEther('0.001'), parseEther('0.01'), parseEther('0.1')];

function bandFor(balanceWei: bigint): number {
  let band = 0;
  for (const threshold of BALANCE_BANDS) if (balanceWei >= threshold) band += 1;
  return band;
}

export async function reputationSignals(address: string | null | undefined): Promise<OnchainSignals | null> {
  if (!address || !ADDRESS_RE.test(address)) return null;
  const addr = address as `0x${string}`;
  const [nonce, balance, humanId] = await Promise.all([
    publicClient.getTransactionCount({ address: addr }).catch(() => 0),
    publicClient.getBalance({ address: addr }).catch(() => 0n),
    lookupHuman(address),
  ]);
  return {
    hasTransacted: nonce > 0,
    balanceBand: bandFor(balance),
    agentRegistered: Boolean(humanId),
  };
}
