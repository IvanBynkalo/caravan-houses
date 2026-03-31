// src/config.ts

export const config = {
  port:         Number(process.env.PORT ?? 3000),
  host:         process.env.HOST ?? '0.0.0.0',
  dbPath:       process.env.DATABASE_PATH ?? './data/caravan.db',
  jwtSecret:    process.env.JWT_SECRET ?? 'dev-secret-change-in-prod',
  botToken:     process.env.TELEGRAM_BOT_TOKEN ?? '',
  nodeEnv:      process.env.NODE_ENV ?? 'development',
  // URL фронтенда для CORS — Railway передаёт как переменную окружения
  frontendUrl:  process.env.FRONTEND_URL ?? '*',
  maxRounds:    12,
  maxCargoHold: 3,
  maxContracts: 3,
  startGold:    6,
  startCargo:   1,
  startCards:   2,
  moveMin:      1,
  moveMax:      3,
} as const;

export const isDev = config.nodeEnv === 'development';
