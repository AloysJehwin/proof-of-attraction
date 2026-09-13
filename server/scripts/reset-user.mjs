// Dev utility: wipe Proof-of-Attraction account data so you can sign up again.
//
// It clears BOTH stores the deployed backend uses:
//   - Neon Postgres: users row (cascades to profiles/likes/matches/messages/rsvps/push_tokens/agent_actions)
//   - Upstash Redis: nullifier:*, usage:*, credit:*, wallet:* keys
//
// NOTE: This does NOT reset World ID's own "already verified" memory for an action.
// If you use real World ID and still get `nullifier_replayed` after resetting here,
// bump EXPO_PUBLIC_WORLD_ID_ACTION (e.g. onboard5 -> onboard6) OR set the action's
// "Max verifications per person" to Unlimited in the World Developer Portal.
//
// Usage (run from the server/ folder):
//   node scripts/reset-user.mjs --all
//   node scripts/reset-user.mjs --handle myhandle
//   node scripts/reset-user.mjs --nullifier 0xabc...
//
// Env is loaded from the repo root .env automatically.

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';

// Load root .env explicitly (scripts run from server/, env lives at repo root).
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

function parseArgs(argv) {
  const args = { all: false, handle: null, nullifier: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--handle') args.handle = argv[++i]?.toLowerCase() ?? null;
    else if (a === '--nullifier') args.nullifier = argv[++i] ?? null;
  }
  return args;
}

function humanIdFromNullifier(nullifierHash) {
  return `human_${String(nullifierHash).slice(0, 24)}`;
}

async function redisDeleteByPatterns(redis, patterns) {
  let deleted = 0;
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    if (keys.length) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  }
  return deleted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('✖ DATABASE_URL not set in .env — nothing to clear in Postgres.');
    process.exit(1);
  }
  if (!args.all && !args.handle && !args.nullifier) {
    console.error('Usage: node scripts/reset-user.mjs (--all | --handle <h> | --nullifier <hash>)');
    process.exit(1);
  }

  const sql = neon(dbUrl);
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

  if (args.all) {
    console.log('⚠  Clearing ALL user data (users + cascade). Events are preserved.');
    const before = await sql`SELECT count(*)::int AS n FROM users`;
    await sql`DELETE FROM users`;
    console.log(`  ✓ Postgres: deleted ${before[0].n} user(s) and cascaded rows.`);

    if (redis) {
      const n = await redisDeleteByPatterns(redis, ['nullifier:*', 'usage:*', 'credit:*', 'wallet:*']);
      console.log(`  ✓ Redis: deleted ${n} key(s) (nullifier/usage/credit/wallet).`);
    } else {
      console.log('  • Redis not configured — skipped.');
    }
    console.log('\nDone. You can sign up fresh (bump the World action if you still hit replay).');
    return;
  }

  // Targeted delete by handle or nullifier.
  const rows = args.handle
    ? await sql`SELECT id, nullifier_hash, handle, wallet FROM users WHERE lower(handle) = ${args.handle}`
    : await sql`SELECT id, nullifier_hash, handle, wallet FROM users WHERE nullifier_hash = ${args.nullifier}`;

  if (!rows.length) {
    console.log(`No user found for ${args.handle ? `handle "${args.handle}"` : `nullifier "${args.nullifier}"`}.`);
    return;
  }

  for (const u of rows) {
    await sql`DELETE FROM users WHERE id = ${u.id}`;
    console.log(`  ✓ Postgres: deleted user ${u.handle ?? u.id} (cascaded profile/likes/matches/messages).`);
    if (redis) {
      const humanId = humanIdFromNullifier(u.nullifier_hash);
      const keys = [`nullifier:${u.nullifier_hash}`, `usage:${humanId}`, `credit:${humanId}`];
      if (u.wallet) keys.push(`wallet:${String(u.wallet).toLowerCase()}`);
      await redis.del(...keys);
      console.log(`  ✓ Redis: cleared ${keys.length} key(s) for ${humanId}.`);
    }
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('✖ reset failed:', err?.message ?? err);
  process.exit(1);
});

