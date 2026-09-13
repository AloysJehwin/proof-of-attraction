import { Hono } from 'hono';
import type { Session } from './auth.js';
import { requireSession } from './auth.js';
import { getRepo } from './repo/index.js';
import { getStorage } from './storage.js';
import { storePhoto } from './blob.js';
import { presignAll } from './s3.js';
import { mintToken, publishMessage, realtimeEnabled } from './realtime.js';
import { sendPush } from './push.js';
import { estimateGenderFromFrames, llmEnabled } from './llm.js';

type Env = { Variables: { session: Session; userId: string } };

const resolveUser = async (c: any, next: any) => {
  const session = c.get('session') as Session;
  const repo = getRepo();
  let user = await repo.getUserByNullifier(session.sub);
  if (!user) user = await repo.upsertUser(session.sub, 'selfie', null);
  c.set('userId', user.id);
  await next();
};

const requireOrb = async (c: any, next: any) => {
  const repo = getRepo();
  const user = await repo.getUser(c.get('userId'));
  if (!user || user.tier !== 'orb') return c.json({ error: 'orb verification required' }, 403);
  await next();
};

export const domain = new Hono<Env>();
domain.use('*', requireSession);
domain.use('*', resolveUser);

domain.get('/me', async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const user = await repo.getUser(userId);
  const profile = await repo.getProfile(userId);
  if (profile) profile.photos = await presignAll(profile.photos);
  return c.json({ user, profile, hasProfile: Boolean(profile) });
});

domain.put('/me/profile', requireOrb, async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.name !== 'string' || typeof body.age !== 'number') {
    return c.json({ error: 'name and age required' }, 400);
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const profile = await repo.upsertProfile(userId, {
    name: body.name,
    age: body.age,
    bio: typeof body.bio === 'string' ? body.bio : undefined,
    interests: Array.isArray(body.interests) ? body.interests.slice(0, 12).map(String) : undefined,
    hasAgent: typeof body.hasAgent === 'boolean' ? body.hasAgent : undefined,
    gender: str(body.gender),
    lookingFor: str(body.lookingFor),
    lat: num(body.lat),
    lng: num(body.lng),
  });
  return c.json({ ok: true, profile });
});

domain.put('/me/handle', requireOrb, async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const handle = typeof body.handle === 'string' ? body.handle.trim().toLowerCase() : '';
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return c.json({ error: 'handle must be 3-20 chars, a-z 0-9 _' }, 400);
  const result = await repo.setHandle(userId, handle);
  if (!result.ok) return c.json({ error: 'handle taken' }, 409);
  return c.json({ ok: true, handle });
});

domain.post('/me/wallet', requireOrb, async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const session = c.get('session');
  const body = await c.req.json().catch(() => ({}));
  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return c.json({ error: 'valid wallet required' }, 400);
  await repo.setWallet(userId, wallet);
  await getStorage().registerWallet(wallet.toLowerCase(), session.humanId);
  return c.json({ ok: true });
});

const CHALLENGES = ['turn your head to the left', 'turn your head to the right', 'smile widely', 'raise your eyebrows'];

domain.get('/me/gender-estimate/challenge', (c) => {
  return c.json({ challenge: CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)] });
});

domain.post('/me/gender-estimate', requireOrb, async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const frames = Array.isArray(body.frames) ? body.frames.filter((f: unknown) => typeof f === 'string') as string[] : [];
  const challenge = typeof body.challenge === 'string' && CHALLENGES.includes(body.challenge) ? body.challenge : null;
  if (frames.length !== 2 || !challenge) return c.json({ error: 'two frames and a valid challenge required' }, 400);
  if (frames.some((f) => !f.startsWith('data:image/'))) return c.json({ error: 'frames must be data-uri images' }, 400);
  if (frames.some((f) => f.length > 2_200_000)) return c.json({ error: 'each frame must be under ~1.6MB' }, 413);
  if (!llmEnabled) return c.json({ error: 'estimator not configured' }, 503);

  const result = await estimateGenderFromFrames(frames, challenge);
  if (!result) return c.json({ error: 'estimator unavailable, try again' }, 502);
  if (!result.live || !result.samePerson || !result.challengePassed) {
    const reason = !result.live ? 'We could not confirm a live camera capture.' : !result.samePerson ? 'The two frames do not look like the same person.' : 'The challenge was not detected in the second frame.';
    return c.json({ ok: false, passed: false, reason, detail: result.reason }, 422);
  }
  const estimate = { label: result.label, confidence: result.confidence, source: 'vision-estimate', challenge, estimatedAt: Date.now() };
  await repo.setGenderEstimate(userId, estimate);
  return c.json({ ok: true, passed: true, estimate });
});

domain.post('/me/photo', async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File)) return c.json({ error: 'photo file required' }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > 8 * 1024 * 1024) return c.json({ error: 'image too large' }, 413);
  const url = await storePhoto(userId, buf, file.type || 'image/jpeg');
  const stored = await repo.addPhoto(userId, url);
  const photos = await presignAll(stored);
  return c.json({ ok: true, url: (await presignAll([url]))[0], photos });
});

domain.get('/discovery', async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const verifiedOnly = c.req.query('verifiedOnly') === 'true';
  const profiles = await repo.discovery(userId, verifiedOnly);
  for (const p of profiles) {
    if (p.photos) p.photos = await presignAll(p.photos);
  }
  return c.json({ profiles });
});

domain.post('/likes', requireOrb, async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const toUser = body.toUser as string | undefined;
  const kind = body.kind === 'pass' ? 'pass' : 'like';
  if (!toUser) return c.json({ error: 'toUser required' }, 400);
  const result = await repo.like(userId, toUser, kind);
  if (result.matched && result.matchId) {
    const tokens = await repo.getPushTokens(toUser);
    await sendPush(tokens, 'New match', 'You matched. Say hi.', { matchId: result.matchId });
  }
  return c.json(result);
});

domain.get('/matches', async (c) => {
  const repo = getRepo();
  const matches = await repo.listMatches(c.get('userId'));
  return c.json({ matches });
});

domain.get('/matches/:id/messages', async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const matchId = c.req.param('id');
  const parts = await repo.matchParticipants(matchId);
  if (!parts || !parts.includes(userId)) return c.json({ error: 'not your match' }, 403);
  const messages = await repo.listMessages(matchId);
  return c.json({ messages });
});

domain.post('/matches/:id/messages', requireOrb, async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const matchId = c.req.param('id');
  const parts = await repo.matchParticipants(matchId);
  if (!parts || !parts.includes(userId)) return c.json({ error: 'not your match' }, 403);
  const body = await c.req.json().catch(() => ({}));
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) return c.json({ error: 'body required' }, 400);
  const message = await repo.addMessage(matchId, userId, text, Boolean(body.viaAgent));
  await publishMessage(matchId, message);
  const otherId = parts[0] === userId ? parts[1] : parts[0];
  const tokens = await repo.getPushTokens(otherId);
  await sendPush(tokens, 'New message', text.slice(0, 80), { matchId });
  return c.json({ ok: true, message });
});

domain.get('/realtime/token', async (c) => {
  if (!realtimeEnabled) return c.json({ enabled: false });
  const repo = getRepo();
  const userId = c.get('userId');
  const matches = await repo.listMatches(userId);
  const token = await mintToken(userId, matches.map((m) => m.matchId));
  return c.json({ enabled: true, token });
});

domain.get('/events', async (c) => {
  const repo = getRepo();
  const events = await repo.listEvents(c.get('userId'));
  return c.json({ events });
});

domain.post('/events/:id/rsvp', requireOrb, async (c) => {
  const repo = getRepo();
  const userId = c.get('userId');
  const result = await repo.rsvp(c.req.param('id'), userId);
  if (!result.ok) return c.json(result, result.reason === 'full' ? 409 : 400);
  return c.json(result);
});

domain.delete('/events/:id/rsvp', async (c) => {
  const repo = getRepo();
  await repo.cancelRsvp(c.req.param('id'), c.get('userId'));
  return c.json({ ok: true });
});

domain.post('/push/register', async (c) => {
  const repo = getRepo();
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.token !== 'string') return c.json({ error: 'token required' }, 400);
  await repo.registerPush(c.get('userId'), body.token, typeof body.platform === 'string' ? body.platform : 'unknown');
  return c.json({ ok: true });
});
