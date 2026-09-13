import { and, eq, or, inArray, desc, sql } from 'drizzle-orm';
import type { db as DbType } from '../db/client.js';
import { users, profiles, likes, matches, messages, events, rsvps, pushTokens, agentActions } from '../db/schema.js';
import type {
  Repo, UserRow, ProfileRow, PublicProfile, MatchSummary, MessageRow, EventRow, LikeResult, SetHandleResult, AgentActionRow, NewAgentAction } from './types.js';
import { rankDiscovery } from '../matching.js';
import { reputationSignals } from '../onchain.js';

const TIER_RANK: Record<string, number> = { unverified: 0, selfie: 1, orb: 2 };
type Db = NonNullable<typeof DbType>;

function toUser(r: typeof users.$inferSelect): UserRow {
  return { id: r.id, nullifierHash: r.nullifierHash, handle: r.handle, tier: r.tier, genderEstimate: r.genderEstimate, wallet: r.wallet ?? null, worldSessionId: r.worldSessionId ?? null, createdAt: r.createdAt.getTime() };
}

function toProfile(r: typeof profiles.$inferSelect): ProfileRow {
  return { userId: r.userId, name: r.name, age: r.age, bio: r.bio, interests: r.interests, photos: r.photos, hasAgent: r.hasAgent, gender: r.gender, lookingFor: r.lookingFor, lat: r.lat, lng: r.lng };
}

export class PgRepo implements Repo {
  constructor(private db: Db) {}

  async upsertUser(nullifierHash: string, tier: string, genderEstimate: unknown) {
    const rows = await this.db
      .insert(users)
      .values({ nullifierHash, tier, genderEstimate })
      .onConflictDoUpdate({ target: users.nullifierHash, set: { tier, genderEstimate } })
      .returning();
    return toUser(rows[0]);
  }

  async getUser(userId: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async getUserByNullifier(nullifierHash: string) {
    const rows = await this.db.select().from(users).where(eq(users.nullifierHash, nullifierHash)).limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async getUserByHandle(handle: string) {
    const rows = await this.db.select().from(users).where(eq(users.handle, handle)).limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async setHandle(userId: string, handle: string): Promise<SetHandleResult> {
    try {
      await this.db.update(users).set({ handle }).where(eq(users.id, userId));
      return { ok: true };
    } catch (e) {
      if (e && typeof e === 'object' && (e as { code?: string }).code === '23505') {
        return { ok: false, reason: 'taken' };
      }
      throw e;
    }
  }

  async setTier(userId: string, tier: string) {
    await this.db.update(users).set({ tier }).where(eq(users.id, userId));
  }

  async getProfile(userId: string) {
    const rows = await this.db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async upsertProfile(userId: string, patch: Partial<ProfileRow>) {
    const values = {
      userId,
      name: patch.name ?? '',
      age: patch.age ?? 0,
      bio: patch.bio ?? '',
      interests: patch.interests ?? [],
      photos: patch.photos ?? [],
      hasAgent: patch.hasAgent ?? false,
      gender: patch.gender ?? null,
      lookingFor: patch.lookingFor ?? null,
      lat: patch.lat ?? null,
      lng: patch.lng ?? null,
    };
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const k of ['name', 'age', 'bio', 'interests', 'photos', 'hasAgent', 'gender', 'lookingFor', 'lat', 'lng'] as const) {
      if (patch[k] !== undefined) set[k] = patch[k];
    }
    const rows = await this.db
      .insert(profiles)
      .values(values)
      .onConflictDoUpdate({ target: profiles.userId, set })
      .returning();
    return toProfile(rows[0]);
  }

  async addPhoto(userId: string, url: string) {
    const rows = await this.db
      .update(profiles)
      .set({ photos: sql`array_append(${profiles.photos}, ${url})`, updatedAt: new Date() })
      .where(eq(profiles.userId, userId))
      .returning();
    return rows[0]?.photos ?? [url];
  }

  async discovery(userId: string, verifiedOnly: boolean) {
    const swiped = await this.db.select({ to: likes.toUser }).from(likes).where(eq(likes.fromUser, userId));
    const excluded = [userId, ...swiped.map((s) => s.to)];
    const self = await this.db
      .select({ p: profiles, tier: users.tier })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(eq(profiles.userId, userId))
      .limit(1);
    const rows = await this.db
      .select({ p: profiles, tier: users.tier, wallet: users.wallet })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(sql`${profiles.userId} not in ${excluded}`);
    const candidates = rows
      .filter((r) => !verifiedOnly || TIER_RANK[r.tier] >= TIER_RANK.selfie)
      .map((r) => ({ ...toProfile(r.p), tier: r.tier } as PublicProfile));
    const walletByUser = new Map(rows.map((r) => [r.p.userId, r.wallet]));
    const selfPublic = self[0] ? ({ ...toProfile(self[0].p), tier: self[0].tier } as PublicProfile) : null;
    return rankDiscovery(selfPublic, candidates, (c) => reputationSignals(walletByUser.get(c.userId) ?? null));
  }

  async setWorldSession(userId: string, sessionId: string) {
    await this.db.update(users).set({ worldSessionId: sessionId }).where(eq(users.id, userId));
  }

  async getUserByWorldSession(sessionId: string) {
    const rows = await this.db.select().from(users).where(eq(users.worldSessionId, sessionId)).limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async setGenderEstimate(userId: string, estimate: unknown) {
    await this.db.update(users).set({ genderEstimate: estimate }).where(eq(users.id, userId));
  }

  async setWallet(userId: string, wallet: string) {
    await this.db.update(users).set({ wallet: wallet.toLowerCase() }).where(eq(users.id, userId));
  }

  async getWallet(userId: string) {
    const rows = await this.db.select({ wallet: users.wallet }).from(users).where(eq(users.id, userId)).limit(1);
    return rows[0]?.wallet ?? null;
  }

  async like(fromUser: string, toUser: string, kind: string): Promise<LikeResult> {
    await this.db
      .insert(likes)
      .values({ fromUser, toUser, kind })
      .onConflictDoNothing({ target: [likes.fromUser, likes.toUser] });
    if (kind !== 'like') return { matched: false };
    const back = await this.db
      .select()
      .from(likes)
      .where(and(eq(likes.fromUser, toUser), eq(likes.toUser, fromUser), eq(likes.kind, 'like')))
      .limit(1);
    if (!back[0]) {
      const auto = await this.db
        .select({ likesEveryone: users.likesEveryone })
        .from(users)
        .where(eq(users.id, toUser))
        .limit(1);
      if (!auto[0]?.likesEveryone) return { matched: false };
      await this.db
        .insert(likes)
        .values({ fromUser: toUser, toUser: fromUser, kind: 'like' })
        .onConflictDoNothing({ target: [likes.fromUser, likes.toUser] });
    }
    const existing = await this.db
      .select()
      .from(matches)
      .where(or(and(eq(matches.userA, fromUser), eq(matches.userB, toUser)), and(eq(matches.userA, toUser), eq(matches.userB, fromUser))))
      .limit(1);
    if (existing[0]) return { matched: true, matchId: existing[0].id };
    const created = await this.db.insert(matches).values({ userA: fromUser, userB: toUser }).returning();
    return { matched: true, matchId: created[0].id };
  }

  async listMatches(userId: string) {
    const rows = await this.db
      .select()
      .from(matches)
      .where(or(eq(matches.userA, userId), eq(matches.userB, userId)));
    const out: MatchSummary[] = [];
    for (const m of rows) {
      const otherId = m.userA === userId ? m.userB : m.userA;
      const prof = await this.getProfile(otherId);
      if (!prof) continue;
      const u = await this.getUser(otherId);
      const last = await this.db
        .select()
        .from(messages)
        .where(eq(messages.matchId, m.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      out.push({
        matchId: m.id,
        other: { ...prof, tier: u?.tier ?? 'unverified' },
        lastMessage: last[0]?.body ?? null,
        lastAt: last[0]?.createdAt.getTime() ?? null,
      });
    }
    return out.sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
  }

  async matchParticipants(matchId: string): Promise<[string, string] | null> {
    const rows = await this.db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    return rows[0] ? [rows[0].userA, rows[0].userB] : null;
  }

  async listMessages(matchId: string) {
    const rows = await this.db.select().from(messages).where(eq(messages.matchId, matchId)).orderBy(messages.createdAt);
    return rows.map((r): MessageRow => ({ id: r.id, matchId: r.matchId, senderUser: r.senderUser, body: r.body, viaAgent: r.viaAgent, createdAt: r.createdAt.getTime() }));
  }

  async addMessage(matchId: string, senderUser: string, body: string, viaAgent: boolean) {
    const rows = await this.db.insert(messages).values({ matchId, senderUser, body, viaAgent }).returning();
    const r = rows[0];
    return { id: r.id, matchId: r.matchId, senderUser: r.senderUser, body: r.body, viaAgent: r.viaAgent, createdAt: r.createdAt.getTime() };
  }

  async listEvents(userId: string) {
    const evs = await this.db.select().from(events);
    const out: EventRow[] = [];
    for (const e of evs) {
      const counts = await this.db.select({ n: sql<number>`count(*)::int` }).from(rsvps).where(eq(rsvps.eventId, e.id));
      const mine = await this.db.select().from(rsvps).where(and(eq(rsvps.eventId, e.id), eq(rsvps.userId, userId))).limit(1);
      out.push({ id: e.id, title: e.title, venue: e.venue, startsAt: e.startsAt, capacity: e.capacity, attendees: counts[0]?.n ?? 0, going: Boolean(mine[0]) });
    }
    return out;
  }

  async rsvp(eventId: string, userId: string) {
    const ev = await this.db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!ev[0]) return { ok: false, reason: 'no such event' };
    const result = await this.db.execute(sql`
      insert into rsvps (event_id, user_id)
      select ${eventId}::uuid, ${userId}::uuid
      where (select count(*) from rsvps where event_id = ${eventId}::uuid) < ${ev[0].capacity}
      on conflict (event_id, user_id) do nothing
      returning id
    `);
    const already = await this.db.select().from(rsvps).where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId))).limit(1);
    if (already[0]) return { ok: true };
    return { ok: false, reason: 'full' };
  }

  async cancelRsvp(eventId: string, userId: string) {
    await this.db.delete(rsvps).where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)));
  }

  async registerPush(userId: string, token: string, platform: string) {
    await this.db.insert(pushTokens).values({ userId, token, platform }).onConflictDoNothing({ target: pushTokens.token });
  }

  async getPushTokens(userId: string) {
    const rows = await this.db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, userId));
    return rows.map((r) => r.token);
  }

  async addAgentAction(userId: string, action: NewAgentAction): Promise<AgentActionRow> {
    const rows = await this.db.insert(agentActions).values({ userId, ...action }).returning();
    return toAgentAction(rows[0]);
  }

  async listAgentActions(userId: string, limit: number): Promise<AgentActionRow[]> {
    const rows = await this.db.select().from(agentActions).where(eq(agentActions.userId, userId)).orderBy(desc(agentActions.createdAt)).limit(limit);
    return rows.map(toAgentAction);
  }

  async revokeAgentAction(userId: string, id: string): Promise<boolean> {
    const rows = await this.db.update(agentActions).set({ revoked: true }).where(and(eq(agentActions.id, id), eq(agentActions.userId, userId))).returning();
    return rows.length > 0;
  }
}

function toAgentAction(r: typeof agentActions.$inferSelect): AgentActionRow {
  return { id: r.id, userId: r.userId, matchId: r.matchId, targetUser: r.targetUser, kind: r.kind, detail: r.detail, agentBacked: r.agentBacked, registered: r.registered, revoked: r.revoked, createdAt: r.createdAt.getTime() };
}
