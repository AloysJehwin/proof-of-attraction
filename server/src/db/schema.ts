import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  nullifierHash: text('nullifier_hash').notNull().unique(),
  handle: text('handle').unique(),
  tier: text('tier').notNull().default('unverified'),
  genderEstimate: jsonb('gender_estimate'),
  wallet: text('wallet'),
  worldSessionId: text('world_session_id').unique(),
  likesEveryone: boolean('likes_everyone').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  bio: text('bio').notNull().default(''),
  interests: text('interests').array().notNull().default([]),
  photos: text('photos').array().notNull().default([]),
  hasAgent: boolean('has_agent').notNull().default(false),
  gender: text('gender'),
  lookingFor: text('looking_for'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromUser: uuid('from_user').notNull().references(() => users.id, { onDelete: 'cascade' }),
  toUser: uuid('to_user').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({ pair: unique().on(t.fromUser, t.toUser) }));

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  userA: uuid('user_a').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userB: uuid('user_b').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({ pair: unique().on(t.userA, t.userB) }));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  senderUser: uuid('sender_user').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  viaAgent: boolean('via_agent').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  venue: text('venue').notNull(),
  startsAt: text('starts_at').notNull(),
  capacity: integer('capacity').notNull(),
});

export const rsvps = pgTable('rsvps', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({ pair: unique().on(t.eventId, t.userId) }));

export const pushTokens = pgTable('push_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  platform: text('platform').notNull(),
});

export const agentActions = pgTable('agent_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId: uuid('match_id').references(() => matches.id, { onDelete: 'cascade' }),
  targetUser: uuid('target_user').references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  detail: text('detail').notNull().default(''),
  agentBacked: boolean('agent_backed').notNull().default(false),
  registered: boolean('registered').notNull().default(false),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
