export type UserRow = {
  id: string;
  nullifierHash: string;
  handle: string | null;
  tier: string;
  genderEstimate: unknown;
  wallet: string | null;
  worldSessionId: string | null;
  createdAt: number;
};

export type ProfileRow = {
  userId: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  photos: string[];
  hasAgent: boolean;
  gender: string | null;
  lookingFor: string | null;
  lat: number | null;
  lng: number | null;
};

export type PublicProfile = ProfileRow & { tier: string; matchScore?: number };

export type MatchSummary = {
  matchId: string;
  other: PublicProfile;
  lastMessage: string | null;
  lastAt: number | null;
};

export type MessageRow = {
  id: string;
  matchId: string;
  senderUser: string;
  body: string;
  viaAgent: boolean;
  createdAt: number;
};

export type EventRow = {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  capacity: number;
  attendees: number;
  going: boolean;
};

export type AgentActionRow = {
  id: string;
  userId: string;
  matchId: string | null;
  targetUser: string | null;
  kind: string;
  detail: string;
  agentBacked: boolean;
  registered: boolean;
  revoked: boolean;
  createdAt: number;
};

export type NewAgentAction = Omit<AgentActionRow, 'id' | 'userId' | 'revoked' | 'createdAt'>;

export type LikeResult = { matched: boolean; matchId?: string };

export type SetHandleResult = { ok: true } | { ok: false; reason: 'taken' };

export interface Repo {
  upsertUser(nullifierHash: string, tier: string, genderEstimate: unknown): Promise<UserRow>;
  getUser(userId: string): Promise<UserRow | null>;
  getUserByNullifier(nullifierHash: string): Promise<UserRow | null>;
  getUserByHandle(handle: string): Promise<UserRow | null>;
  setHandle(userId: string, handle: string): Promise<SetHandleResult>;
  setTier(userId: string, tier: string): Promise<void>;
  setGenderEstimate(userId: string, estimate: unknown): Promise<void>;
  setWorldSession(userId: string, sessionId: string): Promise<void>;
  getUserByWorldSession(sessionId: string): Promise<UserRow | null>;
  setWallet(userId: string, wallet: string): Promise<void>;
  getWallet(userId: string): Promise<string | null>;

  getProfile(userId: string): Promise<ProfileRow | null>;
  upsertProfile(userId: string, patch: Partial<ProfileRow>): Promise<ProfileRow>;
  addPhoto(userId: string, url: string): Promise<string[]>;

  discovery(userId: string, verifiedOnly: boolean): Promise<PublicProfile[]>;
  like(fromUser: string, toUser: string, kind: string): Promise<LikeResult>;

  listMatches(userId: string): Promise<MatchSummary[]>;
  matchParticipants(matchId: string): Promise<[string, string] | null>;
  listMessages(matchId: string): Promise<MessageRow[]>;
  addMessage(matchId: string, senderUser: string, body: string, viaAgent: boolean): Promise<MessageRow>;

  listEvents(userId: string): Promise<EventRow[]>;
  rsvp(eventId: string, userId: string): Promise<{ ok: boolean; reason?: string }>;
  cancelRsvp(eventId: string, userId: string): Promise<void>;

  registerPush(userId: string, token: string, platform: string): Promise<void>;
  getPushTokens(userId: string): Promise<string[]>;

  addAgentAction(userId: string, action: NewAgentAction): Promise<AgentActionRow>;
  listAgentActions(userId: string, limit: number): Promise<AgentActionRow[]>;
  revokeAgentAction(userId: string, id: string): Promise<boolean>;
}
