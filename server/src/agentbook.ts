export const WORLD_CHAIN = 'eip155:480';
export const BASE_CHAIN = 'eip155:8453';

export type VerifyResult = {
  verified: boolean;
  humanId?: string;
  reason?: string;
};

const registry = new Map<string, { humanId: string; usage: number; nonce: number }>();
const trialUsage = new Map<string, number>();

export function seedRegistered(wallet: string, humanId: string) {
  registry.set(wallet.toLowerCase(), { humanId, usage: 0, nonce: 0 });
}

export async function verifyAgent(wallet: string | undefined, chain: string | undefined): Promise<VerifyResult> {
  if (!wallet) return { verified: false, reason: 'missing agent wallet' };

  const entry = registry.get(wallet.toLowerCase());
  if (!entry) {
    return { verified: false, reason: 'not registered in AgentBook' };
  }

  entry.usage += 1;
  entry.nonce += 1;

  return { verified: true, humanId: entry.humanId };
}

export function recordTrialUse(wallet: string): number {
  const next = (trialUsage.get(wallet.toLowerCase()) ?? 0) + 1;
  trialUsage.set(wallet.toLowerCase(), next);
  return next;
}

export function usageFor(wallet: string): number {
  return trialUsage.get(wallet.toLowerCase()) ?? 0;
}

export const FREE_TRIAL_CALLS = 3;
