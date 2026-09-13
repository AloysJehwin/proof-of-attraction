// Dev utility: wipe Proof-of-Attraction account data so you can sign up again.
//
// It clears BOTH stores the deployed backend uses:
//   - Neon Postgres: users row (cascades to profiles/likes/matches/messages/rsvps/push_tokens/agent_actions)
//   - Upstash Redis: nullifier:*, usage:*, credit:*, wallet:* keys
//
// IMPORTANT — why you also need --bump-action:
// In World ID 4.0 a nullifier is unique per (user, rp/app, action) and is ONE-TIME-USE
// for uniqueness proofs. Once a World ID has verified an action, re-verifying that SAME
// action always returns `nullifier_replayed`. World does not expose a reset, and 4.0
// removed "unlimited verifications" for actions.
//   Docs: https://docs.world.org/world-id/idkit/error-codes
//         "nullifier_replayed — Nullifier was already used for this action.
//          Treat as an already-verified outcome; do not retry the same action."
//   Docs: https://docs.world.org/world-id/4-0-migration
//         Use `nullifier` for one-time uniqueness, `session_id` for continuity.
//
// So wiping our DB orphans that World ID: World says "already verified", but we no
// longer have the account to log into. Bumping the action mints a fresh nullifier.
//
// Usage (run from the server/ folder):
//   node scripts/reset-user.mjs --all --bump-action
//   node scripts/reset-user.mjs --handle myhandle
//   node scripts/reset-user.mjs --nullifier 0xabc...
//   node scripts/reset-user.mjs --bump-action          (only rotate the action)
//
// Env is loaded from the repo root .env automatically.

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';

// Load root .env explicitly (scripts run from server/, env lives at repo root).
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

function parseArgs(argv) {
  const args = { all: false, handle: null, nullifier: null, bumpAction: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--bump-action') args.bumpAction = true;
    else if (a === '--handle') args.handle = argv[++i]?.toLowerCase() ?? null;
    else if (a === '--nullifier') args.nullifier = argv[++i] ?? null;
  }
  return args;
}

const ENV_PATH = resolve(__dirname, '../../.env');
const ACTION_KEY = 'EXPO_PUBLIC_WORLD_ID_ACTION';

// Rotate EXPO_PUBLIC_WORLD_ID_ACTION (e.g. onboard5 -> onboard6) so World mints a
// fresh nullifier instead of returning `nullifier_replayed`.
function bumpAction() {
  let raw;
  try {
    raw = readFileSync(ENV_PATH, 'utf8');
  } catch {
    console.log(`  • Could not read ${ENV_PATH} — skipped action bump.`);
    return null;
  }

  const lines = raw.split('\n');
  const idx = lines.findIndex((l) => l.trimStart().startsWith(`${ACTION_KEY}=`));
  const current = idx >= 0 ? lines[idx].split('=').slice(1).join('=').trim() : 'onboard0';

  // Split trailing digits: "onboard5" -> base "onboard", n 5
  const m = /^(.*?)(\d+)$/.exec(current);
  const next = m ? `${m[1]}${Number(m[2]) + 1}` : `${current || 'onboard'}1`;
  const line = `${ACTION_KEY}=${next}`;

  if (idx >= 0) lines[idx] = line;
  else lines.push(line);

  writeFileSync(ENV_PATH, lines.join('\n'));
  console.log(`  ✓ Action rotated: ${current} -> ${next}`);
  return next;
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

  if (!args.all && !args.handle && !args.nullifier && !args.bumpAction) {
    console.error('Usage: node scripts/reset-user.mjs (--all | --handle <h> | --nullifier <hash>) [--bump-action]');
    process.exit(1);
  }

  // Action-only rotation (no DB work requested).
  if (args.bumpAction && !args.all && !args.handle && !args.nullifier) {
    console.log('Rotating World ID action only:');
    const next = bumpAction();
    if (next) console.log(`\nDone. Restart Expo so the new action is inlined:\n  npx expo start -c`);
    return;
  }

  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('✖ DATABASE_URL not set in .env — nothing to clear in Postgres.');
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

    if (args.bumpAction) bumpAction();
    printNextSteps(args.bumpAction);
    return;
  }

  // Targeted delete by handle or nullifier.
  const rows = args.handle
    ? await sql`SELECT id, nullifier_hash, handle, wallet FROM users WHERE lower(handle) = ${args.handle}`
    : await sql`SELECT id, nullifier_hash, handle, wallet FROM users WHERE nullifier_hash = ${args.nullifier}`;

  if (!rows.length) {
    console.log(`No user found for ${args.handle ? `handle "${args.handle}"` : `nullifier "${args.nullifier}"`}.`);
    if (args.bumpAction) bumpAction();
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

  if (args.bumpAction) bumpAction();
  printNextSteps(args.bumpAction);
}

function printNextSteps(bumped) {
  console.log('\nDone.');
  if (bumped) {
    console.log('Restart Expo so the new action is inlined into the bundle:');
    console.log('  npx expo start -c');
  } else {
    console.log('NOTE: World still remembers the old action for your World ID.');
    console.log('If you hit `nullifier_replayed`, re-run with --bump-action.');
  }
}

main().catch((err) => {
  console.error('✖ reset failed:', err?.message ?? err);
  process.exit(1);
});

