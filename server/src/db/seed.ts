import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { eq, and, or, inArray } from 'drizzle-orm';
import { SEED_USERS, SEED_EVENTS, SEED_OPENERS } from '../repo/seed.js';

// The repo keeps a single .env at the root, not in server/.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });

// Imported after env is loaded so the db client sees DATABASE_URL.
const { db } = await import('./client.js');
const { users, profiles, events, likes, matches, messages } = await import('./schema.js');

// Usage:
//   npm run db:seed                     seed profiles + events
//   npm run db:seed -- --matches        also match every seed user with the newest real user
//   npm run db:seed -- --matches alice  match them with the user whose handle is "alice"
//   npm run db:seed -- --clear          remove seeded users/events first
function parseArgs(argv: string[]) {
  const args = { matches: false, handle: null as string | null, clear: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--matches') {
      args.matches = true;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) args.handle = next.toLowerCase();
    } else if (argv[i] === '--clear') {
      args.clear = true;
    }
  }
  return args;
}

async function main() {
  if (!db) {
    console.error('DATABASE_URL not set; nothing to seed');
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));
  const seedHashes = SEED_USERS.map((s) => s.nullifierHash);

  if (args.clear) {
    await db.delete(users).where(inArray(users.nullifierHash, seedHashes));
    console.log(`cleared ${seedHashes.length} seed user(s) and their cascaded rows`);
  }

  // --- Users + profiles -----------------------------------------------------
  const seedIds: { id: string; name: string }[] = [];
  for (const s of SEED_USERS) {
    const u = await db
      .insert(users)
      .values({ nullifierHash: s.nullifierHash, tier: s.tier, handle: s.handle, likesEveryone: s.likesEveryone })
      .onConflictDoUpdate({
        target: users.nullifierHash,
        set: { tier: s.tier, handle: s.handle, likesEveryone: s.likesEveryone },
      })
      .returning();
    await db
      .insert(profiles)
      .values({ userId: u[0].id, ...s.profile })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...s.profile } });
    seedIds.push({ id: u[0].id, name: s.profile.name });
  }
  console.log(`seeded ${seedIds.length} profiles`);

  // --- Events (idempotent: events has no natural unique key) ----------------
  const existingEvents = await db.select({ title: events.title }).from(events);
  const haveTitles = new Set(existingEvents.map((e) => e.title));
  const newEvents = SEED_EVENTS.filter((e) => !haveTitles.has(e.title));
  if (newEvents.length) {
    await db
      .insert(events)
      .values(newEvents.map((e) => ({ title: e.title, venue: e.venue, startsAt: e.startsAt, capacity: e.capacity })));
  }
  console.log(`seeded ${newEvents.length} new event(s) (${SEED_EVENTS.length - newEvents.length} already present)`);

  // --- Optional: matches + conversations with a real user -------------------
  if (args.matches) {
    let me;
    if (args.handle) {
      const rows = await db.select().from(users).where(eq(users.handle, args.handle)).limit(1);
      me = rows[0];
    } else {
      // Newest user that is not one of our seeds.
      const all = await db.select().from(users);
      me = all
        .filter((u) => !seedHashes.includes(u.nullifierHash))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    }

    if (!me) {
      console.log('! no real user found to match with — sign up in the app first, then re-run with --matches');
    } else {
      const partners = seedIds.slice(0, 5);
      for (let i = 0; i < partners.length; i++) {
        const p = partners[i];
        // Mutual likes so the pair is a legitimate match.
        await db
          .insert(likes)
          .values([
            { fromUser: me.id, toUser: p.id, kind: 'like' },
            { fromUser: p.id, toUser: me.id, kind: 'like' },
          ])
          .onConflictDoNothing({ target: [likes.fromUser, likes.toUser] });

        const existing = await db
          .select()
          .from(matches)
          .where(
            or(
              and(eq(matches.userA, me.id), eq(matches.userB, p.id)),
              and(eq(matches.userA, p.id), eq(matches.userB, me.id)),
            ),
          )
          .limit(1);

        const matchId =
          existing[0]?.id ?? (await db.insert(matches).values({ userA: me.id, userB: p.id }).returning())[0].id;

        const already = await db.select().from(messages).where(eq(messages.matchId, matchId)).limit(1);
        if (!already[0]) {
          await db.insert(messages).values({
            matchId,
            senderUser: p.id,
            body: SEED_OPENERS[i % SEED_OPENERS.length],
            viaAgent: i % 3 === 0,
          });
        }
      }
      console.log(`matched ${partners.length} seed users with "${me.handle ?? me.id}" and seeded openers`);
    }
  }

  console.log('seeded');
  process.exit(0);
}

main().catch((e) => {
  console.error('seed failed:', e);
  process.exit(1);
});


