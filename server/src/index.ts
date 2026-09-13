import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { resolveAgent, seedRegistered, FREE_TRIAL_CALLS } from './agentbook.js';
import { issueToken, humanIdFromNullifier, requireSession, type Session } from './auth.js';
import { getStorage } from './storage.js';
import { verifyTopUp, TOPUP_ADDRESS, TOPUP_MIN_WEI, TOPUP_CALLS_GRANTED } from './payments.js';
import { getRepo } from './repo/index.js';
import { publishMessage } from './realtime.js';
import { worldIdEnabled, isCompleteResult, verifyProof, isSessionResult, verifySession } from './worldid.js';
import { worldIdContext } from './worldid-context.js';
import { AGENTKIT_HEADER, verifyAgentRequest } from './agentkit.js';
import { generateIcebreaker, generateContext, generateReply, generateTake, sharedInterests } from './llm.js';
import type { NewAgentAction, ProfileRow } from './repo/types.js';
import { domain } from './routes.js';

type AgentMeta = { registered: boolean; humanId: string; freeTrial: boolean; used: number; agentBacked: boolean; gate: string };
type Env = { Variables: { agent: AgentMeta; session: Session } };

export const app = new Hono<Env>();
app.use('*', cors());

seedRegistered('0xdemoagentwallet', humanIdFromNullifier('demo_nullifier_7f3a'));

app.get('/health', (c) => c.json({ ok: true }));

app.post('/auth/selfie', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';
  const signal = typeof body.signal === 'string' ? body.signal : undefined;
  if (!action) {
    return c.json({ ok: false, error: 'action required' }, 400);
  }

  let nullifierHash: string;
  let tier: string;
  let simulated = false;

  if (worldIdEnabled) {
    if (!isCompleteResult(body)) {
      return c.json({ ok: false, error: 'world id result required' }, 400);
    }
    const outcome = await verifyProof(body.worldid_result);
    if (!outcome.ok) {
      const replayed = outcome.code === 'max_verifications_reached' || outcome.code === 'nullifier_replayed' || /replay/i.test(outcome.error);
      const error = replayed
        ? 'This World ID already signed up. Use "Log in with World ID" instead.'
        : outcome.error;
      return c.json({ ok: false, error, code: replayed ? 'already_registered' : outcome.code }, replayed ? 409 : 400);
    }
    nullifierHash = outcome.nullifierHash;
    tier = outcome.tier;
  } else {
    if (!signal) {
      return c.json({ ok: false, error: 'signal required' }, 400);
    }
    nullifierHash = typeof body.nullifier_hash === 'string' && body.nullifier_hash.length > 0
      ? body.nullifier_hash
      : `sim_${signal}`;
    tier = body.verification_level === 'orb' || body.credential_type === 'orb' ? 'orb' : 'selfie';
    simulated = true;
  }

  const store = getStorage();
  const fresh = await store.recordNullifier(nullifierHash);
  const token = await issueToken(nullifierHash);
  const repo = getRepo();
  const user = await repo.upsertUser(nullifierHash, tier, body.gender_estimate ?? null);
  const profile = await repo.getProfile(user.id);
  return c.json({
    ok: true,
    simulated,
    credential_type: 'selfie_check',
    nullifier_hash: nullifierHash,
    first_use: fresh,
    token,
    tier,
    has_profile: Boolean(profile),
    verified_at: Date.now(),
  });
});

app.post('/auth/worldid/context', worldIdContext);

app.post('/auth/session/create', requireSession, async (c) => {
  const session = c.get('session');
  const body = await c.req.json().catch(() => ({}));
  if (!isSessionResult(body)) return c.json({ ok: false, error: 'world id session result required' }, 400);
  const outcome = await verifySession(body.worldid_result);
  if (!outcome.ok) return c.json({ ok: false, error: outcome.error, code: outcome.code }, 400);
  const repo = getRepo();
  const user = await repo.getUserByNullifier(session.sub);
  if (!user) return c.json({ ok: false, error: 'no user' }, 404);
  await repo.setWorldSession(user.id, outcome.sessionId);
  return c.json({ ok: true, session_id: outcome.sessionId });
});

app.get('/auth/session/lookup', async (c) => {
  const handle = (c.req.query('handle') ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return c.json({ ok: false, error: 'handle required' }, 400);
  const user = await getRepo().getUserByHandle(handle);
  if (!user?.worldSessionId) return c.json({ ok: false, error: 'no account with a World ID session for that handle' }, 404);
  return c.json({ ok: true, session_id: user.worldSessionId });
});

app.post('/auth/session/prove', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isSessionResult(body)) return c.json({ ok: false, error: 'world id session result required' }, 400);
  const outcome = await verifySession(body.worldid_result);
  if (!outcome.ok) return c.json({ ok: false, error: outcome.error, code: outcome.code }, 400);
  const repo = getRepo();
  const user = await repo.getUserByWorldSession(outcome.sessionId);
  if (!user) return c.json({ ok: false, error: 'no account linked to this World ID session' }, 404);
  const token = await issueToken(user.nullifierHash);
  const profile = await repo.getProfile(user.id);
  return c.json({
    ok: true,
    simulated: false,
    credential_type: 'world_session',
    nullifier_hash: user.nullifierHash,
    first_use: false,
    token,
    tier: user.tier,
    has_profile: Boolean(profile),
    verified_at: Date.now(),
  });
});

app.post('/auth/refresh', requireSession, async (c) => {
  const session = c.get('session');
  const token = await issueToken(session.sub);
  return c.json({ ok: true, token });
});

const agentGate = async (c: any, next: any) => {
  const session = c.get('session') as Session;
  const store = getStorage();

  const resourceUri = new URL(c.req.url).toString();
  const agentkitHeader = c.req.header(AGENTKIT_HEADER);
  const verification = await verifyAgentRequest(agentkitHeader, resourceUri);

  let registered: boolean;
  let humanId: string;
  let agentBacked = false;
  const gate = verification.verified ? 'agentkit' : `fallback: ${verification.reason}`;
  if (!verification.verified) console.log('[agentkit] header not verified:', verification.reason, 'header present:', Boolean(agentkitHeader));

  if (verification.verified) {
    agentBacked = true;
    registered = Boolean(verification.humanId);
    humanId = verification.humanId ?? (await store.humanForWallet(verification.address)) ?? session.humanId;
    if (verification.humanId) seedRegistered(verification.address, verification.humanId);
  } else {
    const wallet = c.req.header('x-agent-wallet');
    const resolved = await resolveAgent(wallet);
    registered = resolved.registered;
    humanId = resolved.humanId ?? (wallet ? await store.humanForWallet(wallet) : null) ?? session.humanId;
  }

  const usage = await store.tryIncrementUsage(humanId, FREE_TRIAL_CALLS);
  if (!usage.allowed) {
    return c.json({
      registered,
      humanId,
      agentBacked,
      error: 'free trial exhausted',
      x402: 'payment required',
      topup: { to: TOPUP_ADDRESS, minWei: TOPUP_MIN_WEI.toString(), chainId: 4801 },
    }, 402);
  }

  c.set('agent', { registered, humanId, freeTrial: !registered, used: usage.used, agentBacked, gate });
  await next();
};

app.post('/agent/topup', requireSession, async (c) => {
  const session = c.get('session');
  const body = await c.req.json().catch(() => ({}));
  const txHash = body.txHash as string | undefined;
  if (!txHash) return c.json({ ok: false, error: 'txHash required' }, 400);

  const store = getStorage();
  if (await store.hasUsedNonce(txHash)) {
    return c.json({ ok: false, error: 'tx already credited' }, 409);
  }
  const check = await verifyTopUp(txHash);
  if (!check.valid) return c.json({ ok: false, error: check.reason }, 402);

  await store.recordNonce(txHash);
  await store.creditUsage(session.humanId, TOPUP_CALLS_GRANTED);
  return c.json({ ok: true, credited: TOPUP_CALLS_GRANTED, humanId: session.humanId });
});

app.get('/agent/actions', requireSession, async (c) => {
  const session = c.get('session');
  const repo = getRepo();
  const store = getStorage();
  const user = await repo.getUserByNullifier(session.sub);
  const actions = user ? await repo.listAgentActions(user.id, 50) : [];
  const humanId = (user?.wallet ? await store.humanForWallet(user.wallet) : null) ?? session.humanId;
  const [used, credit] = await Promise.all([store.usageFor(humanId), store.creditFor(humanId)]);
  return c.json({ actions, usage: { used, freeTrial: FREE_TRIAL_CALLS, credit, remaining: Math.max(0, FREE_TRIAL_CALLS + credit - used) } });
});

app.delete('/agent/actions/:id', requireSession, async (c) => {
  const session = c.get('session');
  const repo = getRepo();
  const user = await repo.getUserByNullifier(session.sub);
  if (!user) return c.json({ ok: false, error: 'no user' }, 404);
  const ok = await repo.revokeAgentAction(user.id, c.req.param('id') ?? '');
  return c.json({ ok }, ok ? 200 : 404);
});

const agent = new Hono<Env>();
agent.use('*', requireSession);
agent.use('*', agentGate);

type Pair = { selfId: string; otherId: string; selfProfile: ProfileRow; otherProfile: ProfileRow; matchId: string | null };

const loadPair = async (session: Session, matchId: string | null, targetUserId: string | null): Promise<Pair | null> => {
  const repo = getRepo();
  const self = await repo.getUserByNullifier(session.sub);
  if (!self) return null;
  let otherId: string | null = null;
  if (matchId) {
    const parts = await repo.matchParticipants(matchId);
    if (!parts || !parts.includes(self.id)) return null;
    otherId = parts[0] === self.id ? parts[1] : parts[0];
  } else if (targetUserId && targetUserId !== self.id) {
    otherId = targetUserId;
  }
  if (!otherId) return null;
  const selfProfile = await repo.getProfile(self.id);
  const otherProfile = await repo.getProfile(otherId);
  if (!selfProfile || !otherProfile) return null;
  return { selfId: self.id, otherId, selfProfile, otherProfile, matchId };
};

const record = async (session: Session, pair: Pair | null, meta: AgentMeta, action: Omit<NewAgentAction, 'agentBacked' | 'registered'>) => {
  const repo = getRepo();
  const self = pair ? { id: pair.selfId } : await repo.getUserByNullifier(session.sub);
  if (!self) return;
  await repo.addAgentAction(self.id, { ...action, agentBacked: meta.agentBacked, registered: meta.registered }).catch(() => undefined);
};

const body = async (c: any) => {
  const b = await c.req.json().catch(() => ({}));
  return {
    matchId: typeof b.matchId === 'string' ? b.matchId : null,
    userId: typeof b.userId === 'string' ? b.userId : null,
    style: typeof b.style === 'string' ? b.style : 'warm',
    text: typeof b.body === 'string' ? b.body.trim() : '',
  };
};

agent.post('/context', async (c) => {
  const meta = c.get('agent');
  const session = c.get('session');
  const { matchId, userId } = await body(c);
  const pair = await loadPair(session, matchId, userId);
  let payload: string;
  if (pair) {
    const shared = sharedInterests(pair.selfProfile.interests, pair.otherProfile.interests);
    const generated = matchId
      ? await generateContext(pair.selfProfile, pair.otherProfile)
      : await generateTake(pair.selfProfile, pair.otherProfile, {});
    payload = generated ?? `Shared interests with ${pair.otherProfile.name}: ${shared.join(', ') || 'none yet; ask about their bio'}.`;
  } else {
    payload = 'Shared interests: coffee, climbing.';
  }
  await record(session, pair, meta, { kind: matchId ? 'context' : 'screen', matchId, targetUser: pair?.otherId ?? null, detail: payload });
  return c.json({ registered: meta.registered, used: meta.used, agentBacked: meta.agentBacked, gate: meta.gate, payload });
});

agent.post('/icebreaker', async (c) => {
  const meta = c.get('agent');
  const session = c.get('session');
  const { matchId, style } = await body(c);
  const pair = await loadPair(session, matchId, null);
  let payload: string;
  if (pair) {
    const generated = await generateIcebreaker(pair.selfProfile, pair.otherProfile, style);
    const shared = sharedInterests(pair.selfProfile.interests, pair.otherProfile.interests);
    const topic = shared[0] ?? pair.otherProfile.interests[0] ?? 'what you are into';
    payload = generated ?? `Hey ${pair.otherProfile.name}, your profile stood out. What draws you to ${topic}?`;
  } else {
    payload = 'Hey, your bio made me smile. What is drawing you to climbing lately?';
  }
  await record(session, pair, meta, { kind: 'icebreaker', matchId, targetUser: pair?.otherId ?? null, detail: payload });
  return c.json({ registered: meta.registered, used: meta.used, agentBacked: meta.agentBacked, gate: meta.gate, payload });
});

agent.post('/reply', async (c) => {
  const meta = c.get('agent');
  const session = c.get('session');
  const { matchId, style } = await body(c);
  const pair = await loadPair(session, matchId, null);
  if (!pair || !matchId) return c.json({ registered: meta.registered, used: meta.used, agentBacked: meta.agentBacked, error: 'matchId required' }, 400);
  const repo = getRepo();
  const history = (await repo.listMessages(matchId)).map((m) => ({ fromSelf: m.senderUser === pair.selfId, body: m.body }));
  const generated = await generateReply(pair.selfProfile, pair.otherProfile, history, style);
  const lastTheirs = [...history].reverse().find((m) => !m.fromSelf);
  const payload = generated ?? (lastTheirs ? `That is interesting. Tell me more about that, ${pair.otherProfile.name}.` : `Hey ${pair.otherProfile.name}, how has your week been?`);
  await record(session, pair, meta, { kind: 'reply', matchId, targetUser: pair.otherId, detail: payload });
  return c.json({ registered: meta.registered, used: meta.used, agentBacked: meta.agentBacked, gate: meta.gate, payload });
});

agent.post('/send', async (c) => {
  const meta = c.get('agent');
  const session = c.get('session');
  const { matchId, text } = await body(c);
  if (!matchId || !text) return c.json({ registered: meta.registered, used: meta.used, sent: false, error: 'matchId and body required' }, 400);
  const pair = await loadPair(session, matchId, null);
  if (!pair) return c.json({ registered: meta.registered, used: meta.used, sent: false, error: 'not your match' }, 403);
  const repo = getRepo();
  const message = await repo.addMessage(matchId, pair.selfId, text, true);
  await publishMessage(matchId, message);
  await record(session, pair, meta, { kind: 'send', matchId, targetUser: pair.otherId, detail: text });
  return c.json({ registered: meta.registered, used: meta.used, agentBacked: meta.agentBacked, sent: true, message });
});

app.route('/agent', agent);
app.route('/', domain);
