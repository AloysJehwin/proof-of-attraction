import { randomUUID } from 'node:crypto';
import type {
  Repo, UserRow, ProfileRow, PublicProfile, MatchSummary, MessageRow, EventRow, LikeResult, SetHandleResult, AgentActionRow, NewAgentAction } from './types.js';
import { SEED_USERS, SEED_EVENTS } from './seed.js';
import { rankDiscovery } from '../matching.js';
import { reputationSignals } from '../onchain.js';

const TIER_RANK: Record<string, number> = { unverified: 0, selfie: 1, orb: 2 };

export class MemoryRepo implements Repo {
  private users = new Map<string, UserRow>();
  private byNullifier = new Map<string, string>();
  private byHandle = new Map<string, string>();
  private profiles = new Map<string, ProfileRow>();
  private likes: { fromUser: string; toUser: string; kind: string }[] = [];
  private matches = new Map<string, { userA: string; userB: string; createdAt: number }>();
  private messages: MessageRow[] = [];
  private events = new Map<string, { title: string; venue: string; startsAt: string; capacity: number }>();
  private rsvps: { eventId: string; userId: string }[] = [];
  private pushByUser = new Map<string, { token: string; platform: string }[]>();
  private wallets = new Map<string, string>();
  private agentActions: AgentActionRow[] = [];
  private seedLikers: string[] = [];

  constructor() {
    for (const s of SEED_USERS) {
      this.users.set(s.id, { id: s.id, nullifierHash: s.nullifierHash, handle: null, tier: s.tier, genderEstimate: null, wallet: null, worldSessionId: null, createdAt: Date.now() });
      this.byNullifier.set(s.nullifierHash, s.id);
      this.profiles.set(s.id, { userId: s.id, ...s.profile });
      if (s.likesEveryone) this.seedLikers.push(s.id);
    }
    for (const e of SEED_EVENTS) {
      this.events.set(e.id, { title: e.title, venue: e.venue, startsAt: e.startsAt, capacity: e.capacity });
    }
  }

  async upsertUser(nullifierHash: string, tier: string, genderEstimate: unknown) {
    const existingId = this.byNullifier.get(nullifierHash);
    if (existingId) {
      const u = this.users.get(existingId)!;
      u.tier = tier;
      if (genderEstimate != null) u.genderEstimate = genderEstimate;
      return u;
    }
    const row: UserRow = { id: randomUUID(), nullifierHash, handle: null, tier, genderEstimate: genderEstimate ?? null, wallet: null, worldSessionId: null, createdAt: Date.now() };
    this.users.set(row.id, row);
    this.byNullifier.set(nullifierHash, row.id);
    return row;
  }

  async getUser(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async getUserByNullifier(nullifierHash: string) {
    const id = this.byNullifier.get(nullifierHash);
    return id ? this.users.get(id) ?? null : null;
  }

  async getUserByHandle(handle: string) {
    const id = this.byHandle.get(handle);
    return id ? this.users.get(id) ?? null : null;
  }

  async setHandle(userId: string, handle: string): Promise<SetHandleResult> {
    const existing = this.byHandle.get(handle);
    if (existing && existing !== userId) return { ok: false, reason: 'taken' };
    const u = this.users.get(userId);
    if (!u) return { ok: false, reason: 'taken' };
    if (u.handle && u.handle !== handle) this.byHandle.delete(u.handle);
    u.handle = handle;
    this.byHandle.set(handle, userId);
    return { ok: true };
  }

  async setWorldSession(userId: string, sessionId: string) {
    const u = this.users.get(userId);
    if (u) u.worldSessionId = sessionId;
  }

  async getUserByWorldSession(sessionId: string) {
    for (const u of this.users.values()) if (u.worldSessionId === sessionId) return u;
    return null;
  }

  async setGenderEstimate(userId: string, estimate: unknown) {
    const u = this.users.get(userId);
    if (u) u.genderEstimate = estimate;
  }

  async setWallet(userId: string, wallet: string) {
    this.wallets.set(userId, wallet.toLowerCase());
    const u = this.users.get(userId);
    if (u) u.wallet = wallet.toLowerCase();
  }

  async getWallet(userId: string) {
    return this.wallets.get(userId) ?? null;
  }

  async setTier(userId: string, tier: string) {
    const u = this.users.get(userId);
    if (u) u.tier = tier;
  }

  async getProfile(userId: string) {
    return this.profiles.get(userId) ?? null;
  }

  async upsertProfile(userId: string, patch: Partial<ProfileRow>) {
    const existing = this.profiles.get(userId);
    const next: ProfileRow = {
      userId,
      name: patch.name ?? existing?.name ?? '',
      age: patch.age ?? existing?.age ?? 0,
      bio: patch.bio ?? existing?.bio ?? '',
      interests: patch.interests ?? existing?.interests ?? [],
      photos: patch.photos ?? existing?.photos ?? [],
      hasAgent: patch.hasAgent ?? existing?.hasAgent ?? false,
      gender: patch.gender ?? existing?.gender ?? null,
      lookingFor: patch.lookingFor ?? existing?.lookingFor ?? null,
      lat: patch.lat ?? existing?.lat ?? null,
      lng: patch.lng ?? existing?.lng ?? null,
    };
    this.profiles.set(userId, next);
    return next;
  }

  async addPhoto(userId: string, url: string) {
    const p = await this.upsertProfile(userId, {});
    p.photos = [...p.photos, url];
    this.profiles.set(userId, p);
    return p.photos;
  }

  async discovery(userId: string, verifiedOnly: boolean) {
    const swiped = new Set(this.likes.filter((l) => l.fromUser === userId).map((l) => l.toUser));
    const self = this.profiles.get(userId);
    const selfTier = this.users.get(userId)?.tier ?? 'unverified';
    const out: PublicProfile[] = [];
    for (const [uid, prof] of this.profiles) {
      if (uid === userId || swiped.has(uid)) continue;
      const tier = this.users.get(uid)?.tier ?? 'unverified';
      if (verifiedOnly && TIER_RANK[tier] < TIER_RANK.selfie) continue;
      out.push({ ...prof, tier });
    }
    const selfPublic = self ? { ...self, tier: selfTier } : null;
    return rankDiscovery(selfPublic, out, (c) => reputationSignals(this.wallets.get(c.userId)));
  }

  async like(fromUser: string, toUser: string, kind: string): Promise<LikeResult> {
    if (!this.likes.some((l) => l.fromUser === fromUser && l.toUser === toUser)) {
      this.likes.push({ fromUser, toUser, kind });
    }
    if (kind !== 'like') return { matched: false };
    const seedAutoLikes = this.seedLikers.includes(toUser);
    const reciprocal = seedAutoLikes || this.likes.some((l) => l.fromUser === toUser && l.toUser === fromUser && l.kind === 'like');
    if (!reciprocal) return { matched: false };
    const existing = this.findMatch(fromUser, toUser);
    if (existing) return { matched: true, matchId: existing };
    const id = randomUUID();
    this.matches.set(id, { userA: fromUser, userB: toUser, createdAt: Date.now() });
    return { matched: true, matchId: id };
  }

  private findMatch(a: string, b: string): string | null {
    for (const [id, m] of this.matches) {
      if ((m.userA === a && m.userB === b) || (m.userA === b && m.userB === a)) return id;
    }
    return null;
  }

  async listMatches(userId: string) {
    const out: MatchSummary[] = [];
    for (const [id, m] of this.matches) {
      if (m.userA !== userId && m.userB !== userId) continue;
      const otherId = m.userA === userId ? m.userB : m.userA;
      const prof = this.profiles.get(otherId);
      if (!prof) continue;
      const msgs = this.messages.filter((x) => x.matchId === id).sort((a, b) => a.createdAt - b.createdAt);
      const last = msgs[msgs.length - 1] ?? null;
      out.push({
        matchId: id,
        other: { ...prof, tier: this.users.get(otherId)?.tier ?? 'unverified' },
        lastMessage: last?.body ?? null,
        lastAt: last?.createdAt ?? null,
      });
    }
    return out.sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
  }

  async matchParticipants(matchId: string): Promise<[string, string] | null> {
    const m = this.matches.get(matchId);
    return m ? [m.userA, m.userB] : null;
  }

  async listMessages(matchId: string) {
    return this.messages.filter((m) => m.matchId === matchId).sort((a, b) => a.createdAt - b.createdAt);
  }

  async addMessage(matchId: string, senderUser: string, body: string, viaAgent: boolean) {
    const row: MessageRow = { id: randomUUID(), matchId, senderUser, body, viaAgent, createdAt: Date.now() };
    this.messages.push(row);
    return row;
  }

  async listEvents(userId: string) {
    const out: EventRow[] = [];
    for (const [id, e] of this.events) {
      const attendees = this.rsvps.filter((r) => r.eventId === id).length;
      const going = this.rsvps.some((r) => r.eventId === id && r.userId === userId);
      out.push({ id, title: e.title, venue: e.venue, startsAt: e.startsAt, capacity: e.capacity, attendees, going });
    }
    return out;
  }

  async rsvp(eventId: string, userId: string) {
    const e = this.events.get(eventId);
    if (!e) return { ok: false, reason: 'no such event' };
    if (this.rsvps.some((r) => r.eventId === eventId && r.userId === userId)) return { ok: true };
    const attendees = this.rsvps.filter((r) => r.eventId === eventId).length;
    if (attendees >= e.capacity) return { ok: false, reason: 'full' };
    this.rsvps.push({ eventId, userId });
    return { ok: true };
  }

  async cancelRsvp(eventId: string, userId: string) {
    this.rsvps = this.rsvps.filter((r) => !(r.eventId === eventId && r.userId === userId));
  }

  async registerPush(userId: string, token: string, platform: string) {
    const list = this.pushByUser.get(userId) ?? [];
    if (!list.some((t) => t.token === token)) list.push({ token, platform });
    this.pushByUser.set(userId, list);
  }

  async getPushTokens(userId: string) {
    return (this.pushByUser.get(userId) ?? []).map((t) => t.token);
  }

  async addAgentAction(userId: string, action: NewAgentAction): Promise<AgentActionRow> {
    const row: AgentActionRow = { id: randomUUID(), userId, revoked: false, createdAt: Date.now(), ...action };
    this.agentActions.unshift(row);
    return row;
  }

  async listAgentActions(userId: string, limit: number): Promise<AgentActionRow[]> {
    return this.agentActions.filter((a) => a.userId === userId).slice(0, limit);
  }

  async revokeAgentAction(userId: string, id: string): Promise<boolean> {
    const row = this.agentActions.find((a) => a.id === id && a.userId === userId);
    if (!row) return false;
    row.revoked = true;
    return true;
  }
}
