export type AgentActionKind = 'context' | 'icebreaker' | 'send';

export type AgentCallResult = {
  ok: boolean;
  verified: boolean;
  payload?: string;
  error?: string;
};

const AGENT_API = process.env.EXPO_PUBLIC_AGENT_API ?? '';
export const AGENTKIT_ENABLED = AGENT_API.length > 0;

export const WORLD_CHAIN = 'eip155:480';
export const BASE_CHAIN = 'eip155:8453';

export async function agentCall(
  kind: AgentActionKind,
  args: { matchId: string; matchName: string; walletAddress: string | null },
): Promise<AgentCallResult> {
  if (!AGENTKIT_ENABLED || !args.walletAddress) {
    return simulateAgentCall(kind, args.matchName);
  }
  try {
    const res = await fetch(`${AGENT_API}/agent/${kind}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-wallet': args.walletAddress,
        'x-agent-chain': WORLD_CHAIN,
      },
      body: JSON.stringify({ matchId: args.matchId }),
    });
    const data = (await res.json()) as { verified: boolean; payload?: string };
    return { ok: res.ok, verified: data.verified, payload: data.payload };
  } catch (e) {
    return { ok: false, verified: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

const ICEBREAKERS: Record<string, string[]> = {
  warm: [
    'Hey {name}, your bio made me smile. What is drawing you to climbing lately?',
    'Hi {name}! I noticed we both live on coffee. Whats your go-to order?',
  ],
  witty: [
    '{name}, I promise my puns are worse than yours. Care to test that theory?',
    'Okay {name}, napkin sketches or whiteboard chaos, which team are you on?',
  ],
  direct: [
    'Hi {name}, I liked your profile. Free for a coffee this week?',
    '{name}, straight up, you seem interesting. What are you working on right now?',
  ],
};

async function simulateAgentCall(kind: AgentActionKind, matchName: string): Promise<AgentCallResult> {
  await new Promise((r) => setTimeout(r, 900));
  if (kind === 'icebreaker') {
    const pool = ICEBREAKERS.warm;
    const line = pool[Math.floor(Math.random() * pool.length)].replace('{name}', matchName);
    return { ok: true, verified: true, payload: line };
  }
  if (kind === 'context') {
    return { ok: true, verified: true, payload: `Shared interests with ${matchName}: coffee, climbing.` };
  }
  return { ok: true, verified: true };
}

export function pickIcebreaker(style: 'warm' | 'witty' | 'direct', name: string): string {
  const pool = ICEBREAKERS[style];
  return pool[Math.floor(Math.random() * pool.length)].replace('{name}', name);
}
