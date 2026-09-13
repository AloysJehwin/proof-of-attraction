import {
  AGENTKIT,
  parseAgentkitHeader,
  validateAgentkitMessage,
  verifyAgentkitSignature,
  createAgentBookVerifier,
} from '@worldcoin/agentkit-core';

export const AGENTKIT_HEADER = AGENTKIT;
export const agentkitEnabled = process.env.AGENTKIT_ENABLED !== '0';

const MAX_AGE_SECONDS = 300;
const seenNonces = new Set<string>();

const agentBook = createAgentBookVerifier();

export type AgentVerification =
  | { verified: true; address: string; humanId: string | null }
  | { verified: false; reason: string };

export async function verifyAgentRequest(header: string | undefined, resourceUri: string): Promise<AgentVerification> {
  if (!agentkitEnabled) return { verified: false, reason: 'agentkit disabled' };
  if (!header) return { verified: false, reason: 'no agentkit header' };

  let payload;
  try {
    payload = parseAgentkitHeader(header);
  } catch {
    return { verified: false, reason: 'malformed agentkit header' };
  }

  const validation = await validateAgentkitMessage(payload, resourceUri, {
    maxAge: MAX_AGE_SECONDS,
    checkNonce: (nonce) => !seenNonces.has(nonce),
  });
  if (!validation.valid) return { verified: false, reason: validation.error ?? 'invalid message' };

  const sig = await verifyAgentkitSignature(payload, { rpcUrl: process.env.WORLDCHAIN_SEPOLIA_RPC });
  if (!sig.valid || !sig.address) return { verified: false, reason: sig.error ?? 'invalid signature' };

  const humanId = await agentBook.lookupHuman(sig.address).catch(() => null);
  seenNonces.add(payload.nonce);
  return { verified: true, address: sig.address, humanId };
}

export async function lookupHuman(address: string): Promise<string | null> {
  return agentBook.lookupHuman(address).catch(() => null);
}
