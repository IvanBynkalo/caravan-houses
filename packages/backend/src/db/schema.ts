import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─────────────────────────────────────────────
//  USERS
// ─────────────────────────────────────────────

export const users = sqliteTable('users', {
  id:          text('id').primaryKey(),          // telegram_id
  username:    text('username'),
  displayName: text('display_name').notNull(),
  createdAt:   integer('created_at').notNull(),
  lastSeen:    integer('last_seen'),
});

// ─────────────────────────────────────────────
//  ROOMS
// ─────────────────────────────────────────────

export const rooms = sqliteTable('rooms', {
  id:         text('id').primaryKey(),
  code:       text('code').notNull().unique(),
  hostId:     text('host_id').notNull().references(() => users.id),
  status:     text('status', { enum: ['waiting', 'started', 'finished'] })
                .notNull()
                .default('waiting'),
  maxPlayers: integer('max_players').notNull().default(2),
  createdAt:  integer('created_at').notNull(),
});

// ─────────────────────────────────────────────
//  ROOM PLAYERS
// ─────────────────────────────────────────────

export const roomPlayers = sqliteTable('room_players', {
  roomId:    text('room_id').notNull().references(() => rooms.id),
  userId:    text('user_id').notNull().references(() => users.id),
  seatIndex: integer('seat_index').notNull(),
  joinedAt:  integer('joined_at').notNull(),
});

// ─────────────────────────────────────────────
//  MATCHES
// ─────────────────────────────────────────────

export const matches = sqliteTable('matches', {
  id:         text('id').primaryKey(),
  roomId:     text('room_id').notNull().references(() => rooms.id),
  status:     text('status', { enum: ['active', 'finished'] })
                .notNull()
                .default('active'),
  stateJson:  text('state_json').notNull(),
  round:      integer('round').notNull().default(1),
  maxRounds:  integer('max_rounds').notNull().default(12),
  createdAt:  integer('created_at').notNull(),
  updatedAt:  integer('updated_at').notNull(),
  finishedAt: integer('finished_at'),
});

// ─────────────────────────────────────────────
//  MATCH EVENTS LOG
// ─────────────────────────────────────────────

export const matchEvents = sqliteTable('match_events', {
  id:          integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  matchId:     text('match_id').notNull().references(() => matches.id),
  round:       integer('round').notNull(),
  playerId:    text('player_id').notNull(),
  eventType:   text('event_type').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt:   integer('created_at').notNull(),
});
