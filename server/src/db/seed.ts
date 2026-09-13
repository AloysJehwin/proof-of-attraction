import 'dotenv/config';
import { db } from './client.js';
import { users, profiles, events } from './schema.js';
import { SEED_USERS, SEED_EVENTS } from '../repo/seed.js';

async function main() {
  if (!db) {
    console.error('DATABASE_URL not set; nothing to seed');
    process.exit(1);
  }
  for (const s of SEED_USERS) {
    const u = await db
      .insert(users)
      .values({ nullifierHash: s.nullifierHash, tier: s.tier, likesEveryone: s.likesEveryone })
      .onConflictDoUpdate({ target: users.nullifierHash, set: { tier: s.tier, likesEveryone: s.likesEveryone } })
      .returning();
    await db
      .insert(profiles)
      .values({ userId: u[0].id, ...s.profile })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...s.profile } });
  }
  for (const e of SEED_EVENTS) {
    await db.insert(events).values({ title: e.title, venue: e.venue, startsAt: e.startsAt, capacity: e.capacity }).onConflictDoNothing();
  }
  console.log('seeded');
  process.exit(0);
}

main();
