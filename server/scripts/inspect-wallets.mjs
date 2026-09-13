import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '../.env' });
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);

// `--clear <handle>` unlinks a wallet so you can retest auto-linking.
const clearIdx = process.argv.indexOf('--clear');
if (clearIdx !== -1) {
  const handle = process.argv[clearIdx + 1];
  if (!handle) {
    console.error('usage: node scripts/inspect-wallets.mjs --clear <handle>');
    process.exit(1);
  }
  await sql`UPDATE users SET wallet = NULL WHERE handle = ${handle}`;
  console.log(`cleared wallet for @${handle}\n`);
}

const rows = await sql`
  SELECT u.handle, u.tier, u.wallet, p.name
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE u.nullifier_hash NOT LIKE 'seed_null_%'
  ORDER BY u.created_at DESC`;

console.log('Real (non-seed) users:');
for (const r of rows) {
  console.log(`  @${String(r.handle ?? '-').padEnd(10)} ${String(r.tier).padEnd(7)} wallet=${r.wallet ?? '(none)'}`);
}


