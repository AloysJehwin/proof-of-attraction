import { authedFetch } from '../auth/session';
import { VerificationTier } from '../verification/tiers';
import type { GenderEstimate } from '../verification/genderEstimate';

export type ApiProfile = {
  userId: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  photos: string[];
  hasAgent: boolean;
  gender: string | null;
  lookingFor: string | null;
  lat: number | null;
  lng: number | null;
  tier: VerificationTier;
  matchScore?: number;
};

export type ApiMatch = {
  matchId: string;
  other: ApiProfile;
  lastMessage: string | null;
  lastAt: number | null;
};

export type ApiMessage = {
  id: string;
  matchId: string;
  senderUser: string;
  body: string;
  viaAgent: boolean;
  createdAt: number;
};

export type ApiEvent = {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  capacity: number;
  attendees: number;
  going: boolean;
};

export type Me = {
  user: { id: string; nullifierHash: string; handle: string | null; tier: VerificationTier; genderEstimate: GenderEstimate | null; wallet: string | null } | null;
  profile: ApiProfile | null;
  hasProfile: boolean;
};

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) throw new Error(`server error (${res.status})`);
    throw new Error('unexpected server response');
  }
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data as T;
}

export async function getMe(): Promise<Me> {
  return json(await authedFetch('/me'));
}

export async function saveProfile(patch: {
  name: string;
  age: number;
  bio?: string;
  interests?: string[];
  hasAgent?: boolean;
  gender?: string;
  lookingFor?: string;
  lat?: number;
  lng?: number;
}): Promise<{ ok: true; profile: ApiProfile }> {
  return json(await authedFetch('/me/profile', { method: 'PUT', body: JSON.stringify(patch) }));
}

export async function saveHandle(handle: string): Promise<{ ok: true; handle: string }> {
  return json(await authedFetch('/me/handle', { method: 'PUT', body: JSON.stringify({ handle }) }));
}

export async function saveWallet(wallet: string): Promise<{ ok: true }> {
  return json(await authedFetch('/me/wallet', { method: 'POST', body: JSON.stringify({ wallet }) }));
}

export async function getDiscovery(verifiedOnly: boolean): Promise<ApiProfile[]> {
  const res = await authedFetch(`/discovery?verifiedOnly=${verifiedOnly ? 'true' : 'false'}`);
  const data = await json<{ profiles: ApiProfile[] }>(res);
  return data.profiles;
}

export async function like(toUser: string, kind: 'like' | 'pass'): Promise<{ matched: boolean; matchId?: string }> {
  return json(await authedFetch('/likes', { method: 'POST', body: JSON.stringify({ toUser, kind }) }));
}

export async function getMatches(): Promise<ApiMatch[]> {
  const data = await json<{ matches: ApiMatch[] }>(await authedFetch('/matches'));
  return data.matches;
}

export async function getMessages(matchId: string): Promise<ApiMessage[]> {
  const data = await json<{ messages: ApiMessage[] }>(await authedFetch(`/matches/${matchId}/messages`));
  return data.messages;
}

export async function sendMessage(matchId: string, body: string, viaAgent = false): Promise<ApiMessage> {
  const data = await json<{ ok: true; message: ApiMessage }>(
    await authedFetch(`/matches/${matchId}/messages`, { method: 'POST', body: JSON.stringify({ body, viaAgent }) })
  );
  return data.message;
}

export async function getRealtimeToken(): Promise<{ enabled: boolean; token?: unknown }> {
  return json(await authedFetch('/realtime/token'));
}

export async function getEvents(): Promise<ApiEvent[]> {
  const data = await json<{ events: ApiEvent[] }>(await authedFetch('/events'));
  return data.events;
}

export async function rsvp(eventId: string): Promise<{ ok: boolean; reason?: string }> {
  return json(await authedFetch(`/events/${eventId}/rsvp`, { method: 'POST' }));
}

export async function cancelRsvp(eventId: string): Promise<{ ok: boolean }> {
  return json(await authedFetch(`/events/${eventId}/rsvp`, { method: 'DELETE' }));
}

export async function registerPushToken(token: string, platform: string): Promise<void> {
  await authedFetch('/push/register', { method: 'POST', body: JSON.stringify({ token, platform }) });
}

export type ApiAgentAction = {
  id: string;
  matchId: string | null;
  targetUser: string | null;
  kind: 'context' | 'screen' | 'icebreaker' | 'reply' | 'send';
  detail: string;
  agentBacked: boolean;
  registered: boolean;
  revoked: boolean;
  createdAt: number;
};

export type ApiAgentUsage = { used: number; freeTrial: number; credit: number; remaining: number };

export async function getAgentActions(): Promise<{ actions: ApiAgentAction[]; usage: ApiAgentUsage }> {
  return json(await authedFetch('/agent/actions'));
}

export async function revokeAgentAction(id: string): Promise<{ ok: boolean }> {
  return json(await authedFetch(`/agent/actions/${id}`, { method: 'DELETE' }));
}

export async function getGenderChallenge(): Promise<string> {
  const data = await json<{ challenge: string }>(await authedFetch('/me/gender-estimate/challenge'));
  return data.challenge;
}

export type GenderEstimateResponse =
  | { ok: true; passed: true; estimate: GenderEstimate }
  | { ok: false; passed: false; reason: string; detail?: string };

export async function submitGenderEstimate(frames: string[], challenge: string): Promise<GenderEstimateResponse> {
  const res = await authedFetch('/me/gender-estimate', { method: 'POST', body: JSON.stringify({ frames, challenge }) });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(res.status === 413 ? 'frames too large for the server' : `server error (${res.status})`);
  }
  if (res.status === 422) return { ok: false, passed: false, reason: data.reason ?? 'check failed', detail: data.detail };
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data as GenderEstimateResponse;
}
