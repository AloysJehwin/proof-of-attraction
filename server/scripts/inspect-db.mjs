import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '../.env' });

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);

const users = await sql`SELECT count(*)::int n FROM users`;
const profs = await sql`SELECT count(*)::int n FROM profiles`;
const evs = await sql`SELECT count(*)::int n FROM events`;
const mts = await sql`SELECT count(*)::int n FROM matches`;
const msgs = await sql`SELECT count(*)::int n FROM messages`;

console.log(`users=${users[0].n}  profiles=${profs[0].n}  events=${evs[0].n}  matches=${mts[0].n}  messages=${msgs[0].n}`);

console.log('\nProfiles:');
const rows = await sql`
  SELECT p.name, p.age, u.tier, u.handle, p.gender, p.looking_for, array_to_string(p.interests, ',') AS interests
  FROM profiles p JOIN users u ON u.id = p.user_id
  ORDER BY p.name`;
for (const r of rows) {
  console.log(`  ${String(r.name).padEnd(8)} ${String(r.age).padEnd(3)} ${String(r.tier).padEnd(7)} @${String(r.handle ?? '-').padEnd(8)} ${String(r.gender ?? '-').padEnd(10)} -> ${String(r.looking_for ?? '-').padEnd(9)} [${r.interests}]`);
}

console.log('\nEvents:');
const ev = await sql`SELECT title, venue, starts_at, capacity FROM events ORDER BY title`;
for (const e of ev) console.log(`  ${String(e.title).padEnd(30)} ${String(e.venue).padEnd(18)} ${e.starts_at}  cap ${e.capacity}`);

