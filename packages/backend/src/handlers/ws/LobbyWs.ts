import type { FastifyInstance } from 'fastify';
import { getDb }                from '../../db/index.js';
import { rooms, roomPlayers, users } from '../../db/schema.js';
import { eq }                   from 'drizzle-orm';

// lobbyId → Set<WebSocket>
const lobbyConnections = new Map<string, Set<any>>();

export function broadcastToLobby(roomId: string, payload: object): void {
  const sockets = lobbyConnections.get(roomId);
  if (!sockets) return;
  const msg = JSON.stringify(payload);
  for (const ws of sockets) {
    try { ws.send(msg); } catch { /* ignore */ }
  }
}

export async function lobbyWsRoutes(app: FastifyInstance): Promise<void> {
  app.register(async (wsApp) => {
    wsApp.get('/ws/lobby/:roomId', { websocket: true }, (socket, req) => {
      const { roomId } = req.params as { roomId: string };

      if (!lobbyConnections.has(roomId)) lobbyConnections.set(roomId, new Set());
      lobbyConnections.get(roomId)!.add(socket);

      // Сразу отправить текущее состояние лобби
      sendLobbyState(socket, roomId);

      socket.on('close', () => {
        lobbyConnections.get(roomId)?.delete(socket);
      });
    });
  });
}

function sendLobbyState(socket: any, roomId: string): void {
  try {
    const db   = getDb();
    const room = db.select().from(rooms).where(eq(rooms.id, roomId)).get();
    if (!room) return;

    const seats = db.select().from(roomPlayers)
      .where(eq(roomPlayers.roomId, roomId)).all();

    const players = seats.map(s => ({
      userId:      s.userId,
      displayName: db.select().from(users).where(eq(users.id, s.userId)).get()?.displayName ?? s.userId,
      seatIndex:   s.seatIndex,
    }));

    socket.send(JSON.stringify({
      type:    'lobby_state',
      roomId,
      code:    room.code,
      status:  room.status,
      hostId:  room.hostId,
      players,
    }));
  } catch { /* ignore */ }
}
