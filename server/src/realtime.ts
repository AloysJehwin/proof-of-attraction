import Ably from 'ably';

const KEY = process.env.ABLY_API_KEY;
export const realtimeEnabled = Boolean(KEY);

let rest: Ably.Rest | null = null;
function client(): Ably.Rest {
  if (!rest) rest = new Ably.Rest(KEY!);
  return rest;
}

export async function mintToken(clientId: string, matchIds: string[]) {
  const capability: Record<string, string[]> = {};
  for (const id of matchIds) capability[`chat:${id}`] = ['subscribe', 'publish', 'presence'];
  if (matchIds.length === 0) capability['chat:none'] = ['subscribe'];
  return client().auth.createTokenRequest({ clientId, capability: JSON.stringify(capability) });
}

export async function publishMessage(matchId: string, payload: unknown) {
  if (!realtimeEnabled) return;
  await client().channels.get(`chat:${matchId}`).publish('message', payload);
}
