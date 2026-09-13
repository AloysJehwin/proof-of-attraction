import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '../.env' });
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);

const handle = process.argv[2] || 'michael';

const rows = await sql`
  SELECT p.name,
         (SELECT body FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last,
         (SELECT via_agent FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS agent
  FROM matches m
  JOIN users me ON me.handle = ${handle}
  JOIN users o ON o.id = CASE WHEN m.user_a = me.id THEN m.user_b ELSE m.user_a END
  JOIN profiles p ON p.user_id = o.id
  WHERE m.user_a = me.id OR m.user_b = me.id
  ORDER BY p.name`;

console.log(`Matches for @${handle}: ${rows.length}`);
for (const r of rows) {
  const tag = r.agent ? '[via agent]' : '           ';
  console.log(`  ${String(r.name).padEnd(8)} ${tag} ${r.last ? `"${r.last}"` : '(no messages yet)'}`);
}

