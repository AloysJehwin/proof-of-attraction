import { sign, verify } from 'hono/jwt';
import type { Context, Next } from 'hono';

const SECRET = process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me';
const TTL_SECONDS = 60 * 60 * 24 * 7;

export type Session = { sub: string; humanId: string; exp: number };

export async function issueToken(nullifierHash: string): Promise<string> {
  const humanId = humanIdFromNullifier(nullifierHash);
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return sign({ sub: nullifierHash, humanId, exp }, SECRET, 'HS256');
}

export function humanIdFromNullifier(nullifierHash: string): string {
  return `human_${nullifierHash.slice(0, 24)}`;
}

export async function requireSession(c: Context, next: Next) {
  const header = c.req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return c.json({ error: 'missing bearer token' }, 401);
  try {
    const payload = (await verify(token, SECRET, 'HS256')) as unknown as Session;
    c.set('session', payload);
    await next();
  } catch {
    return c.json({ error: 'invalid or expired token' }, 401);
  }
}
