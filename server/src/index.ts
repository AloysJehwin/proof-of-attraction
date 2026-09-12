import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { resolveAgent, seedRegistered, FREE_TRIAL_CALLS } from './agentbook.js';
import { issueToken, humanIdFromNullifier, requireSession, type Session } from './auth.js';
import { getStorage } from './storage.js';
import { verifyTopUp, TOPUP_ADDRESS, TOPUP_MIN_WEI, TOPUP_CALLS_GRANTED } from './payments.js';

type AgentMeta = { registered: boolean; humanId: string; freeTrial: boolean; used: number };
type Env = { Variables: { agent: AgentMeta; session: Session } };

export const app = new Hono<Env>();
app.use('*', cors());

seedRegistered('0xdemoagentwallet', humanIdFromNullifier('demo_nullifier_7f3a'));

app.get('/health', (c) => c.json({ ok: true }));

app.post('/auth/selfie', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.signal || !body.action) {
    return c.json({ ok: false, error: 'signal and action required' }, 400);
  }
  const nullifierHash = typeof body.nullifier_hash === 'string' && body.nullifier_hash.length > 0
    ? body.nullifier_hash
    : `srv_${body.signal}_${Date.now().toString(36)}`;
  const store = getStorage();
  const fresh = await store.recordNullifier(nullifierHash);
  const token = await issueToken(nullifierHash);
  return c.json({
    ok: true,
    credential_type: 'selfie_check',
    nullifier_hash: nullifierHash,
    first_use: fresh,
    token,
    verified_at: Date.now(),
  });
});

app.post('/auth/refresh', requireSession, async (c) => {
  const session = c.get('session');
  const token = await issueToken(session.sub);
  return c.json({ ok: true, token });
});

const agentGate = async (c: any, next: any) => {
  const wallet = c.req.header('x-agent-wallet');
  const session = c.get('session') as Session;
  const store = getStorage();
  const resolved = await resolveAgent(wallet);
  const humanId = resolved.humanId ?? (wallet ? await store.humanForWallet(wallet) : null) ?? session.humanId;

  const gate = await store.tryIncrementUsage(humanId, FREE_TRIAL_CALLS);
  if (!gate.allowed) {
    return c.json({
      registered: resolved.registered,
      humanId,
      error: 'free trial exhausted',
      x402: 'payment required',
      topup: { to: TOPUP_ADDRESS, minWei: TOPUP_MIN_WEI.toString(), chainId: 4801 },
    }, 402);
  }

  c.set('agent', { registered: resolved.registered, humanId, freeTrial: !resolved.registered, used: gate.used });
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

const agent = new Hono<Env>();
agent.use('*', requireSession);
agent.use('*', agentGate);

agent.post('/context', (c) => {
  const meta = c.get('agent');
  return c.json({ registered: meta.registered, used: meta.used, payload: 'Shared interests: coffee, climbing.' });
});

agent.post('/icebreaker', (c) => {
  const meta = c.get('agent');
  return c.json({
    registered: meta.registered,
    used: meta.used,
    payload: 'Hey, your bio made me smile. What is drawing you to climbing lately?',
  });
});

agent.post('/send', (c) => {
  const meta = c.get('agent');
  return c.json({ registered: meta.registered, used: meta.used, sent: true });
});

app.route('/agent', agent);
