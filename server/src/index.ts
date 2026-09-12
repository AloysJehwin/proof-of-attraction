import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyAgent, seedRegistered, usageFor, recordTrialUse, FREE_TRIAL_CALLS } from './agentbook.js';

type AgentMeta = { verified: boolean; humanId: string | null; freeTrial: boolean };
type Env = { Variables: { agent: AgentMeta } };

const app = new Hono<Env>();
app.use('*', cors());

seedRegistered('0xdemoagentwallet', 'anon_human_7f3a');

app.get('/health', (c) => c.json({ ok: true }));

app.post('/verify/selfie', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.signal || !body.action) {
    return c.json({ ok: false, error: 'signal and action required' }, 400);
  }
  return c.json({
    ok: true,
    credential_type: 'selfie_check',
    nullifier_hash: `srv_${body.signal}_${Date.now().toString(36)}`,
    verified_at: Date.now(),
  });
});

const agentGate = async (c: any, next: any) => {
  const wallet = c.req.header('x-agent-wallet');
  const chain = c.req.header('x-agent-chain');
  const result = await verifyAgent(wallet, chain);

  if (!result.verified) {
    const used = wallet ? usageFor(wallet) : FREE_TRIAL_CALLS;
    if (wallet && used < FREE_TRIAL_CALLS) {
      recordTrialUse(wallet);
      c.set('agent', { verified: false, humanId: null, freeTrial: true });
      await next();
      return;
    }
    return c.json({ verified: false, error: result.reason, x402: 'payment required' }, 402);
  }
  c.set('agent', { verified: true, humanId: result.humanId ?? null, freeTrial: false });
  await next();
};

const agent = new Hono<Env>();
agent.use('*', agentGate);

agent.post('/context', (c) => {
  const meta = c.get('agent');
  return c.json({ verified: meta.verified, payload: 'Shared interests: coffee, climbing.' });
});

agent.post('/icebreaker', (c) => {
  const meta = c.get('agent');
  return c.json({
    verified: meta.verified,
    payload: 'Hey, your bio made me smile. What is drawing you to climbing lately?',
  });
});

agent.post('/send', (c) => {
  const meta = c.get('agent');
  return c.json({ verified: meta.verified, sent: true });
});

app.route('/agent', agent);

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`server on http://localhost:${port}`);
