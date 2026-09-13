import { signRequest } from '@worldcoin/idkit-core/signing';
import type { Context } from 'hono';

const RP_ID = process.env.RP_ID ?? '';
const RP_SIGNING_KEY = process.env.RP_SIGNING_KEY ?? '';
const APP_ID = process.env.WORLD_APP_ID ?? process.env.EXPO_PUBLIC_WORLD_APP_ID ?? '';
const RP_CONTEXT_TTL = Number(process.env.RP_CONTEXT_TTL ?? 300);

export const worldIdSigningEnabled = RP_ID.length > 0 && RP_SIGNING_KEY.length > 0;

export async function worldIdContext(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const session = body.session === true;
  const action = typeof body.action === 'string' && body.action.length > 0 ? body.action : 'onboard';

  if (!worldIdSigningEnabled) {
    return c.json({ ok: false, error: 'world id signing not configured' }, 503);
  }

  const { sig, nonce, createdAt, expiresAt } = signRequest(
    session ? { signingKeyHex: RP_SIGNING_KEY, ttl: RP_CONTEXT_TTL } : { signingKeyHex: RP_SIGNING_KEY, action, ttl: RP_CONTEXT_TTL },
  );

  return c.json({
    ok: true,
    rp_context: {
      rp_id: RP_ID,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      signature: sig,
    },
    app_id: APP_ID,
    action: session ? null : action,
    session,
  });
}
