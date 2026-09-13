import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '../.env' });
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);

// Keep the oldest row per (title, venue, starts_at); delete the rest.
// RSVPs cascade, so move any RSVPs to the survivor first.
const dupes = await sql`
  SELECT title, venue, starts_at, array_agg(id ORDER BY id) AS ids
  FROM events
  GROUP BY title, venue, starts_at
  HAVING count(*) > 1`;

let removed = 0;
for (const d of dupes) {
  const [keep, ...drop] = d.ids;
  for (const id of drop) {
    await sql`UPDATE rsvps SET event_id = ${keep}
              WHERE event_id = ${id}
                AND user_id NOT IN (SELECT user_id FROM rsvps WHERE event_id = ${keep})`;
    await sql`DELETE FROM events WHERE id = ${id}`;
    removed++;
  }
  console.log(`  deduped "${d.title}" (removed ${drop.length})`);
}

const left = await sql`SELECT count(*)::int n FROM events`;
console.log(`\nRemoved ${removed} duplicate event(s). ${left[0].n} events remain.`);

