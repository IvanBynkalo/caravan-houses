import Fastify               from 'fastify';
import fastifyWs             from '@fastify/websocket';
import fastifyJwt            from '@fastify/jwt';
import fastifyCors           from '@fastify/cors';
import { config, isDev }     from './config.js';
import { getDb }             from './db/index.js';
import { authRoutes, roomRoutes } from './handlers/http/routes.js';
import { lobbyWsRoutes }     from './handlers/ws/LobbyWs.js';
import { handleIntent }      from './handlers/ws/IntentRouter.js';
import { registerConnection, removeConnection } from './rooms/MatchStore.js';
import type { ClientMessage } from '@caravan/shared';

const app = Fastify({
  logger: {
    level: isDev ? 'info' : 'warn',
    transport: isDev
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

async function bootstrap() {
  await app.register(fastifyCors, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
      const allowed = [config.frontendUrl, 'http://localhost:5173', 'http://localhost:3000'];
      if (!origin) return cb(null, true);
      if (config.frontendUrl === '*') return cb(null, true);
      if (allowed.includes(origin) || origin.endsWith('.vercel.app')) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });

  await app.register(fastifyJwt, { secret: config.jwtSecret });
  await app.register(fastifyWs);

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(roomRoutes, { prefix: '/' });
  await app.register(lobbyWsRoutes);

  app.get('/health', async () => ({ ok: true, ts: Date.now() }));

  app.register(async (wsApp) => {
    wsApp.get('/ws/match/:matchId', { websocket: true }, (socket, req) => {
      const { matchId } = req.params as { matchId: string };
      let playerId = 'unknown';

      const conn = {
        send: (data: string) => {
          if (socket.readyState === socket.OPEN) socket.send(data);
        },
        playerId,
      };

      socket.on('message', async (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString()) as ClientMessage;

          if (!playerId || playerId === 'unknown') {
            playerId      = msg.playerId;
            conn.playerId = playerId;
            registerConnection(matchId, conn);
          }

          if (msg.intent.type === 'reconnect_to_match') {
            registerConnection(matchId, conn);
          }

          await handleIntent(matchId, playerId, msg.intent);
        } catch (err: unknown) {
          app.log.error(err, 'WS message error');
          socket.send(JSON.stringify({
            event: { type: 'error', code: 'INTERNAL', message: 'Server error' },
          }));
        }
      });

      socket.on('close', () => {
        removeConnection(matchId, playerId);
      });

      socket.on('error', (err: unknown) => {
        app.log.error(err, 'WebSocket error');
        removeConnection(matchId, playerId);
      });
    });
  });

  getDb();

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Caravan Houses backend running on port ${config.port}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
