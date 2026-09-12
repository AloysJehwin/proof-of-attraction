import { SelfieCredential } from './tiers';
import { estimateGender, GenderEstimate } from './genderEstimate';

export type SelfieCheckParams = {
  userId: string;
  action: string;
  requireUserPresence?: boolean;
};

export type SelfieCheckResult = {
  ok: boolean;
  credential?: SelfieCredential;
  token?: string;
  genderEstimate?: GenderEstimate;
  error?: string;
};

const APP_ID = process.env.EXPO_PUBLIC_WORLD_APP_ID ?? 'app_staging_stub';
const AGENT_API = process.env.EXPO_PUBLIC_AGENT_API ?? '';

export const SELFIE_CHECK_ENABLED = AGENT_API.length > 0;

export function buildSelfiePreset(params: SelfieCheckParams) {
  return {
    app_id: APP_ID,
    action: params.action,
    signal: params.userId,
    require_user_presence: params.requireUserPresence ?? true,
  };
}

export async function runSelfieCheck(params: SelfieCheckParams): Promise<SelfieCheckResult> {
  if (!SELFIE_CHECK_ENABLED) {
    return simulateSelfieCheck(params);
  }
  try {
    const res = await fetch(`${AGENT_API}/auth/selfie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSelfiePreset(params)),
    });
    if (!res.ok) {
      return { ok: false, error: `verify failed (${res.status})` };
    }
    const data = (await res.json()) as { nullifier_hash: string; token: string };
    return {
      ok: true,
      token: data.token,
      genderEstimate: await estimateGender(params.userId),
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
    genderEstimate: await estimateGender(params.userId),
    credential: {
      verifiedAt: Date.now(),
      signalUserId: params.userId,
      nullifierHash: `sim_${params.userId}_${Date.now().toString(36)}`,
    },
  };
}
