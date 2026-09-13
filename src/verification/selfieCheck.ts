import { SelfieCredential, VerificationTier } from './tiers';
import { requestWorldIdProof } from './WorldIdProvider';
import * as SecureStore from 'expo-secure-store';
import { authedFetch } from '../auth/session';

export type SelfieCheckParams = {
  userId: string;
  action: string;
  requireUserPresence?: boolean;
};

export type SelfieCheckResult = {
  ok: boolean;
  credential?: SelfieCredential;
  token?: string;
  tier?: VerificationTier;
  firstUse?: boolean;
  hasProfile?: boolean;
  error?: string;
  code?: string;
};

const SESSION_KEY = 'poa_world_session';

export async function getStoredWorldSession(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(SESSION_KEY); } catch { return null; }
}

async function storeWorldSession(id: string): Promise<void> {
  try { await SecureStore.setItemAsync(SESSION_KEY, id); } catch {}
}

export async function clearStoredWorldSession(): Promise<void> {
  try { await SecureStore.deleteItemAsync(SESSION_KEY); } catch {}
}

export async function createWorldSession(): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  if (!WORLD_ID_ENABLED) return { ok: false, error: 'world id disabled' };
  const outcome = await requestWorldIdProof({ action: 'session', signal: '', mode: 'create-session' });
  if (outcome.cancelled) return { ok: false, error: 'cancelled' };
  if (!outcome.result) return { ok: false, error: outcome.error ?? 'no result' };
  try {
    const res = await authedFetch('/auth/session/create', { method: 'POST', body: JSON.stringify({ worldid_result: outcome.result }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.session_id) return { ok: false, error: data.error ?? `session create failed (${res.status})` };
    await storeWorldSession(data.session_id);
    return { ok: true, sessionId: data.session_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export async function lookupWorldSession(handle: string): Promise<{ ok: boolean; sessionId?: string; error?: string }> {
  try {
    const res = await fetch(`${AGENT_API}/auth/session/lookup?handle=${encodeURIComponent(handle)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.session_id) return { ok: false, error: data.error ?? 'lookup failed' };
    return { ok: true, sessionId: data.session_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

export async function loginWithWorldSession(sessionId: string): Promise<SelfieCheckResult> {
  if (!WORLD_ID_ENABLED) return { ok: false, error: 'world id disabled' };
  const outcome = await requestWorldIdProof({ action: 'session', signal: '', mode: 'prove-session', sessionId });
  if (outcome.cancelled) return { ok: false, error: 'verification cancelled' };
  if (!outcome.result) return { ok: false, error: outcome.error ?? 'no result' };
  try {
    const res = await fetch(`${AGENT_API}/auth/session/prove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldid_result: outcome.result }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) {
      if (res.status === 404) await clearStoredWorldSession();
      return { ok: false, error: data.error ?? `login failed (${res.status})`, code: data.code };
    }
    await storeWorldSession(sessionId);
    return {
      ok: true,
      token: data.token,
      tier: data.tier === 'orb' ? 'orb' : 'selfie',
      firstUse: false,
      hasProfile: data.has_profile,
      credential: { verifiedAt: Date.now(), signalUserId: '', nullifierHash: data.nullifier_hash },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

const APP_ID = process.env.EXPO_PUBLIC_WORLD_APP_ID ?? 'app_staging_stub';
const VERIFY_URL = process.env.EXPO_PUBLIC_VERIFY_URL ?? '';
const AGENT_API = process.env.EXPO_PUBLIC_AGENT_API ?? '';
const DEV_ORB = process.env.EXPO_PUBLIC_DEV_ORB === '1';

export const SELFIE_CHECK_ENABLED = AGENT_API.length > 0;
export const WORLD_ID_ENABLED = SELFIE_CHECK_ENABLED && VERIFY_URL.length > 0 && APP_ID.startsWith('app_') && APP_ID !== 'app_staging_stub';

export function buildSelfiePreset(params: SelfieCheckParams): Record<string, unknown> {
  const preset: Record<string, unknown> = {
    app_id: APP_ID,
    action: params.action,
    signal: params.userId,
    require_user_presence: params.requireUserPresence ?? true,
  };
  if (DEV_ORB) preset.verification_level = 'orb';
  return preset;
}

export async function runSelfieCheck(params: SelfieCheckParams): Promise<SelfieCheckResult> {
  if (!SELFIE_CHECK_ENABLED) {
    return simulateSelfieCheck(params);
  }
  if (WORLD_ID_ENABLED) {
    return verifyWithWorldId(params);
  }
  return postToServer(params, buildSelfiePreset(params));
}

async function verifyWithWorldId(params: SelfieCheckParams): Promise<SelfieCheckResult> {
  const outcome = await requestWorldIdProof({ action: params.action, signal: params.userId });
  if (outcome.cancelled) return { ok: false, error: 'verification cancelled' };
  if (!outcome.result) return { ok: false, error: outcome.error ?? 'no result' };
  return postToServer(params, {
    action: params.action,
    signal: params.userId,
    worldid_result: outcome.result,
  });
}

async function postToServer(params: SelfieCheckParams, body: Record<string, unknown>): Promise<SelfieCheckResult> {
  try {
    const res = await fetch(`${AGENT_API}/auth/selfie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return { ok: false, error: detail.error ? `${detail.error}` : `verify failed (${res.status})`, code: detail.code };
    }
    const data = (await res.json()) as {
      nullifier_hash: string;
      token: string;
      tier?: string;
      first_use?: boolean;
      has_profile?: boolean;
    };
    const tier: VerificationTier = data.tier === 'orb' ? 'orb' : 'selfie';
    return {
      ok: true,
      token: data.token,
      tier,
      firstUse: data.first_use,
      hasProfile: data.has_profile,
      credential: {
        verifiedAt: Date.now(),
        signalUserId: params.userId,
        nullifierHash: data.nullifier_hash,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

async function simulateSelfieCheck(params: SelfieCheckParams): Promise<SelfieCheckResult> {
  await new Promise((r) => setTimeout(r, 1400));
  return {
    ok: true,
    token: `sim_token_${params.userId}`,
    tier: DEV_ORB ? 'orb' : 'selfie',
    credential: {
      verifiedAt: Date.now(),
      signalUserId: params.userId,
      nullifierHash: `sim_${params.userId}`,
    },
  };
}
