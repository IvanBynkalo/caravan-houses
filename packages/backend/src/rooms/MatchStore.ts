import type { MatchState } from '@caravan/shared';
import { getDb } from '../db/index.js';
import { matches } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { serializeState, deserializeState } from '../engine/match/MatchEngine.js';

// In-memory кэш активных матчей
const cache = new Map<string, MatchState>();
// matchId → roomId (нужен для persist)
const roomIndex = new Map<string, string>();

// WebSocket connections: matchId → Map<playerId, conn>
type WsConnection = { send: (data: string) => void; playerId: string };
const connections = new Map<string, Map<string, WsConnection>>();

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────

export function getMatch(matchId: string): MatchState | null {
  if (cache.has(matchId)) return cache.get(matchId)!;

  // Попробовать загрузить из БД
  const db  = getDb();
  const row = db.select().from(matches).where(eq(matches.id, matchId)).get();
  if (!row) return null;

  const state = deserializeState(row.stateJson);
  cache.set(matchId, state);
  roomIndex.set(matchId, row.roomId);
  return state;
}

export function setMatch(state: MatchState, roomId?: string): void {
  cache.set(state.id, state);
  if (roomId) roomIndex.set(state.id, roomId);
  persistMatch(state);
}

function persistMatch(state: MatchState): void {
  const db     = getDb();
  const now    = Date.now();
  const json   = serializeState(state);
  const roomId = roomIndex.get(state.id) ?? state.id; // fallback to matchId

  db.insert(matches).values({
    id:         state.id,
    roomId,
    stateJson:  json,
    round:      state.round,
    maxRounds:  state.maxRounds,
    status:     state.status === 'finished' ? 'finished' : 'active',
    createdAt:  now,
    updatedAt:  now,
    finishedAt: state.status === 'finished' ? now : null,
  }).onConflictDoUpdate({
    target: matches.id,
    set: {
      stateJson:  json,
      round:      state.round,
      status:     state.status === 'finished' ? 'finished' : 'active',
      updatedAt:  now,
      finishedAt: state.status === 'finished' ? now : null,
    },
  }).run();
}

// ─────────────────────────────────────────────
//  CONNECTIONS
// ─────────────────────────────────────────────

export function registerConnection(matchId: string, conn: WsConnection): void {
  if (!connections.has(matchId)) connections.set(matchId, new Map());
  connections.get(matchId)!.set(conn.playerId, conn);
}

export function removeConnection(matchId: string, playerId: string): void {
  connections.get(matchId)?.delete(playerId);
}

export function broadcastToMatch(matchId: string, event: object): void {
  const conns = connections.get(matchId);
  if (!conns) return;
  const payload = JSON.stringify({ event });
  for (const conn of conns.values()) {
    try { conn.send(payload); } catch { /* ignore closed */ }
  }
}

export function sendToPlayer(matchId: string, playerId: string, event: object): void {
  const conn = connections.get(matchId)?.get(playerId);
  if (!conn) return;
  try { conn.send(JSON.stringify({ event })); } catch { /* ignore */ }
}
