export const WORLD_CHAIN = 'eip155:480';
export const BASE_CHAIN = 'eip155:8453';
export const FREE_TRIAL_CALLS = 3;

export type ResolveResult = {
  registered: boolean;
  humanId?: string;
  reason?: string;
};

const registry = new Map<string, string>();

export function seedRegistered(wallet: string, humanId: string) {
  registry.set(wallet.toLowerCase(), humanId);
}

export async function resolveAgent(wallet: string | undefined): Promise<ResolveResult> {
  if (!wallet) return { registered: false, reason: 'missing agent wallet' };
  const humanId = registry.get(wallet.toLowerCase());
  if (!humanId) return { registered: false, reason: 'not registered in AgentBook' };
  return { registered: true, humanId };
}
