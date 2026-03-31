import type { FastifyInstance } from 'fastify';
import { createHmac }           from 'crypto';
import { getDb }                from '../../db/index.js';
import { users, rooms, roomPlayers } from '../../db/schema.js';
import { eq, and }              from 'drizzle-orm';
import { nanoid, shortId }      from '../../utils/nanoid.js';
import { config, isDev }        from '../../config.js';
import { createMatch }          from '../../engine/match/MatchEngine.js';
import { setMatch, getMatch }   from '../../rooms/MatchStore.js';

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // POST /auth/telegram
  app.post<{ Body: { initData: string } }>('/auth/telegram', async (req, reply) => {
    const { initData } = req.body;
    if (!initData) return reply.status(400).send({ error: 'Missing initData' });

    // Верифицируем Telegram initData
    const user = verifyTelegramInitData(initData, config.botToken);
    if (!user) {
      if (isDev) {
        // В dev-режиме — создать тестового пользователя
        const devUser = { id: 'dev_user_1', first_name: 'Dev', username: 'dev' };
        return upsertAndSign(app, reply, devUser);
      }
      return reply.status(401).send({ error: 'Invalid initData' });
    }

    return upsertAndSign(app, reply, user);
  });
}

function verifyTelegramInitData(
  initData: string,
  botToken: string,
): Record<string, string> | null {
  try {
    const params = new URLSearchParams(initData);
    const hash   = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const expected  = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (expected !== hash) return null;

    const userParam = params.get('user');
    if (!userParam) return null;
    return JSON.parse(userParam);
  } catch {
    return null;
  }
}

async function upsertAndSign(app: FastifyInstance, reply: any, telegramUser: any) {
  const db  = getDb();
  const now = Date.now();
  const id  = String(telegramUser.id);
  const displayName = [telegramUser.first_name, telegramUser.last_name]
    .filter(Boolean).join(' ') || telegramUser.username || `User_${id}`;

  db.insert(users).values({
    id,
    username:    telegramUser.username ?? null,
    displayName,
    createdAt:   now,
    lastSeen:    now,
  }).onConflictDoUpdate({
    target: users.id,
    set: { lastSeen: now, displayName },
  }).run();

  const token = await app.jwt.sign({ sub: id, name: displayName });
  return reply.send({ token, userId: id, displayName });
}

// ─────────────────────────────────────────────
//  ROOMS
// ─────────────────────────────────────────────

export async function roomRoutes(app: FastifyInstance): Promise<void> {

  // Все room routes требуют JWT
  app.addHook('onRequest', async (req, reply) => {
    try { await req.jwtVerify(); }
    catch { reply.status(401).send({ error: 'Unauthorized' }); }
  });

  // POST /rooms — создать комнату
  app.post('/rooms', async (req, reply) => {
    const playerId = (req.user as any).sub as string;
    const db       = getDb();
    const now      = Date.now();
    const roomId   = nanoid();
    const code     = shortId();

    db.insert(rooms).values({
      id: roomId, code, hostId: playerId,
      status: 'waiting', maxPlayers: 2, createdAt: now,
    }).run();

    db.insert(roomPlayers).values({
      roomId, userId: playerId, seatIndex: 0, joinedAt: now,
    }).run();

    return reply.send({ roomId, code });
  });

  // POST /rooms/:code/join — войти в комнату
  app.post<{ Params: { code: string } }>('/rooms/:code/join', async (req, reply) => {
    const playerId = (req.user as any).sub as string;
    const db       = getDb();
    const now      = Date.now();

    const room = db.select().from(rooms)
      .where(eq(rooms.code, req.params.code)).get();
    if (!room)                   return reply.status(404).send({ error: 'Room not found' });
    if (room.status !== 'waiting') return reply.status(409).send({ error: 'Match already started' });

    const existing = db.select().from(roomPlayers)
      .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, playerId))).get();
    if (!existing) {
      const seats = db.select().from(roomPlayers)
        .where(eq(roomPlayers.roomId, room.id)).all();
      if (seats.length >= room.maxPlayers) {
        return reply.status(409).send({ error: 'Room is full' });
      }
      db.insert(roomPlayers).values({
        roomId: room.id, userId: playerId, seatIndex: seats.length, joinedAt: now,
      }).run();
    }

    return reply.send({ roomId: room.id, code: room.code });
  });

  // POST /rooms/:roomId/start — запустить матч
  app.post<{ Params: { roomId: string } }>('/rooms/:roomId/start', async (req, reply) => {
    const playerId = (req.user as any).sub as string;
    const db       = getDb();

    const room = db.select().from(rooms).where(eq(rooms.id, req.params.roomId)).get();
    if (!room)                    return reply.status(404).send({ error: 'Room not found' });
    if (room.hostId !== playerId) return reply.status(403).send({ error: 'Only host can start' });
    if (room.status !== 'waiting') return reply.status(409).send({ error: 'Already started' });

    const seats = db.select().from(roomPlayers)
      .where(eq(roomPlayers.roomId, room.id)).all();

    // Solo vs AI: если 1 игрок
    const playerList = seats.map(s => ({
      id:          s.userId,
      displayName: db.select().from(users).where(eq(users.id, s.userId)).get()?.displayName ?? s.userId,
      isAI:        false,
    }));

    if (playerList.length === 1) {
      playerList.push({ id: 'ai_player', displayName: 'AI Противник', isAI: true });
    }

    const matchState = createMatch({
      matchId: room.id,
      mapId:   'map-mvp',
      players: playerList,
    });

    setMatch(matchState, room.id);

    db.update(rooms).set({ status: 'started' }).where(eq(rooms.id, room.id)).run();

    return reply.send({ matchId: matchState.id });
  });

  // GET /rooms/:roomId/lobby — состояние лобби (для поллинга)
  app.get<{ Params: { roomId: string } }>('/rooms/:roomId/lobby', async (req, reply) => {
    const db   = getDb();
    const room = db.select().from(rooms).where(eq(rooms.id, req.params.roomId)).get();
    if (!room) return reply.status(404).send({ error: 'Room not found' });

    const seats = db.select().from(roomPlayers)
      .where(eq(roomPlayers.roomId, room.id)).all();

    const playerList = seats.map(s => ({
      userId:      s.userId,
      displayName: db.select().from(users).where(eq(users.id, s.userId)).get()?.displayName ?? s.userId,
      seatIndex:   s.seatIndex,
    }));

    return reply.send({
      roomId:  room.id,
      code:    room.code,
      status:  room.status,
      hostId:  room.hostId,
      players: playerList,
    });
  });

  // GET /matches/:matchId — получить состояние (для reconnect)
  app.get<{ Params: { matchId: string } }>('/matches/:matchId', async (req, reply) => {
    const state = getMatch(req.params.matchId);
    if (!state) return reply.status(404).send({ error: 'Match not found' });
    return reply.send({ state });
  });
}
