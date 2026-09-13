import { authedFetch } from '../auth/session';
import type { ApiMessage } from '../api';
import { topUpAgent, signAgentMessage, TopUpResult } from '../wallet/topup';
import { createAgentkitClient, declareAgentkitExtension } from '@worldcoin/agentkit';

export type AgentActionKind = 'context' | 'icebreaker' | 'reply' | 'send';

export type AgentCallResult = {
  ok: boolean;
  registered: boolean;
  agentBacked?: boolean;
  gate?: string;
  payload?: string;
  message?: ApiMessage;
  error?: string;
  toppedUp?: TopUpResult;
};

export type AgentCallArgs = {
  matchId?: string | null;
  userId?: string | null;
  matchName: string;
  walletAddress: string | null;
  style?: string;
  body?: string;
};

const AGENT_API = process.env.EXPO_PUBLIC_AGENT_API ?? '';
export const AGENTKIT_ENABLED = AGENT_API.length > 0;

export const AGENT_SIGN_CHAIN = 'eip155:4801';
export const WORLD_CHAIN = 'eip155:480';

async function buildAgentkitHeader(kind: AgentActionKind, walletAddress: string): Promise<string | null> {
  try {
    const resourceUri = `${AGENT_API}/agent/${kind}`;
    const client = createAgentkitClient({
      signer: {
        address: walletAddress,
        chainId: AGENT_SIGN_CHAIN,
        type: 'eip191',
        signMessage: (message: string) => signAgentMessage(message),
      },
    });
    const extensions = declareAgentkitExtension({ resourceUri, network: AGENT_SIGN_CHAIN });
    const extension = Object.values(extensions)[0];
    if (!extension) return null;
    const header = await client.createHeader(extension);
    lastHeaderError = null;
    return header;
  } catch (e) {
    lastHeaderError = e instanceof Error ? e.message : String(e);
    console.log('[agentkit] header build failed:', lastHeaderError);
    return null;
  }
}

let lastHeaderError: string | null = null;
let lastGate: string | null = null;

export function agentDiagnostics(): { headerError: string | null; gate: string | null } {
  return { headerError: lastHeaderError, gate: lastGate };
}

export async function agentCall(kind: AgentActionKind, args: AgentCallArgs): Promise<AgentCallResult> {
  if (!AGENTKIT_ENABLED || !args.walletAddress) {
    return simulateAgentCall(kind, args.matchName);
  }

  const first = await requestAgent(kind, args);
  if (first.status !== 402) return first.result;

  const topup = await topUpAgent();
  if (!topup.ok) {
    return { ok: false, registered: false, error: topup.error ?? 'top-up failed' };
  }
  const retry = await requestAgent(kind, args);
  return { ...retry.result, toppedUp: topup };
}

async function requestAgent(kind: AgentActionKind, args: AgentCallArgs): Promise<{ status: number; result: AgentCallResult }> {
  try {
    const headers: Record<string, string> = { 'x-agent-wallet': args.walletAddress ?? '', 'x-agent-chain': AGENT_SIGN_CHAIN };
    if (args.walletAddress) {
      const signed = await buildAgentkitHeader(kind, args.walletAddress);
      if (signed) headers.agentkit = signed;
    }
    const res = await authedFetch(`/agent/${kind}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ matchId: args.matchId ?? null, userId: args.userId ?? null, style: args.style ?? 'warm', body: args.body }),
    });
    const data = (await res.json().catch(() => ({}))) as { registered?: boolean; agentBacked?: boolean; gate?: string; payload?: string; message?: ApiMessage; error?: string };
    lastGate = data.gate ?? null;
    return {
      status: res.status,
      result: { ok: res.ok, registered: Boolean(data.registered), agentBacked: Boolean(data.agentBacked), gate: data.gate, payload: data.payload, message: data.message, error: data.error },
    };
  } catch (e) {
    return { status: 0, result: { ok: false, registered: false, error: e instanceof Error ? e.message : 'network error' } };
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
    return { ok: true, registered: true, payload: line };
  }
  if (kind === 'context') {
    return { ok: true, registered: true, payload: `Shared interests with ${matchName}: coffee, climbing.` };
  }
  if (kind === 'reply') {
    return { ok: true, registered: true, payload: `That sounds great, ${matchName}. What got you into it?` };
  }
  return { ok: true, registered: true };
}

export function pickIcebreaker(style: 'warm' | 'witty' | 'direct', name: string): string {
  const pool = ICEBREAKERS[style];
  return pool[Math.floor(Math.random() * pool.length)].replace('{name}', name);
}
