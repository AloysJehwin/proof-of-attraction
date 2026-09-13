const APP_ID = process.env.WORLD_APP_ID ?? process.env.EXPO_PUBLIC_WORLD_APP_ID ?? 'app_staging_stub';
const RP_ID = process.env.RP_ID ?? '';

export const worldIdEnabled = APP_ID.startsWith('app_') && APP_ID !== 'app_staging_stub';

export type WorldIdResult = { responses: unknown[]; [key: string]: unknown };

export type VerifyOutcome =
  | { ok: true; nullifierHash: string; tier: 'orb' | 'selfie' }
  | { ok: false; error: string; code?: string };

function tierFor(identifier: string): 'orb' | 'selfie' {
  return identifier === 'proof_of_human' ? 'orb' : 'selfie';
}

export function isCompleteResult(body: any): body is { worldid_result: WorldIdResult } {
  return (
    typeof body?.worldid_result === 'object' &&
    body.worldid_result !== null &&
    Array.isArray(body.worldid_result.responses)
  );
}

export async function verifyProof(result: WorldIdResult): Promise<VerifyOutcome> {
  if (!RP_ID) {
    return { ok: false, error: 'rp not configured' };
  }

  const res = await fetch(`https://developer.world.org/api/v4/verify/${RP_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });
  const data: any = await res.json().catch(() => ({}));

  if (!res.ok || data?.success !== true) {
    console.log('[worldid] verify failed', res.status, JSON.stringify(data).slice(0, 600));
    const nested = Array.isArray(data?.results) ? data.results.find((r: any) => r?.error || r?.code) : null;
    return {
      ok: false,
      error: data?.detail ?? data?.error ?? nested?.detail ?? nested?.error ?? 'verification failed',
      code: data?.code ?? nested?.code,
    };
  }

  const nullifierHash: string | undefined = data.nullifier ?? data.results?.[0]?.nullifier;
  if (!nullifierHash) {
    return { ok: false, error: 'no nullifier in response' };
  }

  const identifier: string = data.results?.[0]?.identifier ?? '';
  return { ok: true, nullifierHash, tier: tierFor(identifier) };
}

export type SessionOutcome =
  | { ok: true; sessionId: string; sessionNullifier: string | null; tier: 'orb' | 'selfie' }
  | { ok: false; error: string; code?: string };

export function isSessionResult(body: any): body is { worldid_result: WorldIdResult & { session_id: string } } {
  return isCompleteResult(body) && typeof (body.worldid_result as any).session_id === 'string';
}

export async function verifySession(result: WorldIdResult): Promise<SessionOutcome> {
  if (!RP_ID) return { ok: false, error: 'rp not configured' };
  const res = await fetch(`https://developer.world.org/api/v4/verify/${RP_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.success !== true) {
    console.log('[worldid] session verify failed', res.status, JSON.stringify(data).slice(0, 600));
    return { ok: false, error: data?.detail ?? data?.error ?? 'session verification failed', code: data?.code };
  }
  const sessionId: string | undefined = data.session_id ?? (result as any).session_id;
  if (!sessionId) return { ok: false, error: 'no session id in response' };
  const first = data.results?.[0] ?? (result.responses?.[0] as any);
  const sn = first?.session_nullifier;
  const sessionNullifier = Array.isArray(sn) ? sn[0] ?? null : typeof sn === 'string' ? sn : null;
  const identifier: string = first?.identifier ?? 'proof_of_human';
  return { ok: true, sessionId, sessionNullifier, tier: tierFor(identifier) };
}
