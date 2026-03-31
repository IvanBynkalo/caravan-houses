# Caravan Houses / Торговые Дома

Пошаговая стратегическая игра для Telegram Web App.

## Стек

| Слой | Технология |
|---|---|
| Backend | Node.js 20 + TypeScript + Fastify + WebSocket |
| БД | SQLite (better-sqlite3) + Drizzle ORM |
| Frontend | React 18 + Vite + Tailwind CSS + Zustand |
| Shared | TypeScript типы (общие для бэка и фронта) |
| Платформа | Telegram Web App |

## Структура проекта

```
caravan-houses/
├── shared/                  # Общие TypeScript типы
│   └── src/
│       ├── match.ts         # MatchState, PlayerState
│       ├── intents.ts       # Intent-команды (client→server)
│       ├── events.ts        # ServerEvent, StateDiff
│       ├── map.ts           # MapData, NodeType
│       └── gamedata.ts      # ContractData, SpecialistData...
├── packages/
│   ├── backend/
│   │   └── src/
│   │       ├── server.ts           # Точка входа
│   │       ├── config.ts           # Конфигурация
│   │       ├── db/                 # Схема + миграции
│   │       ├── engine/
│   │       │   ├── match/          # MatchEngine, TurnEngine, ScoringEngine, RouteValidator, NodeResolver
│   │       │   ├── map/            # MapLoader (BFS)
│   │       │   ├── cards/          # CatalogLoader
│   │       │   └── ai/             # AIAgent
│   │       ├── handlers/
│   │       │   ├── ws/             # IntentRouter
│   │       │   └── http/           # auth, rooms
│   │       ├── rooms/              # MatchStore (in-memory + SQLite)
│   │       └── data/
│   │           ├── maps/map-mvp.json
│   │           └── gamedata.json
│   └── frontend/
│       └── src/
│           ├── App.tsx             # Роутер
│           ├── screens/            # Auth, MainMenu, Lobby, Match, Results
│           ├── components/
│           │   ├── map/MapView.tsx # SVG карта
│           │   ├── modals/         # NodeActionModal, HandDrawer, DeliveryModal
│           │   └── ui/             # ToastStack
│           ├── store/matchStore.ts # Zustand
│           ├── hooks/useMatchSocket.ts
│           └── lib/               # api.ts, telegram.ts
```

## Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить бэкенд

```bash
cd packages/backend
cp .env.example .env
# Заполнить JWT_SECRET и TELEGRAM_BOT_TOKEN
```

### 3. Настроить фронтенд

```bash
cd packages/frontend
cp .env.example .env
```

### 4. Запустить в dev-режиме

```bash
# Терминал 1 — бэкенд
npm run dev:backend

# Терминал 2 — фронтенд
npm run dev:frontend
```

Фронтенд: http://localhost:5173
Бэкенд: http://localhost:3000

### 5. В dev-режиме Telegram не нужен

Backend автоматически создаёт тестового пользователя при `NODE_ENV=development`.

## Игровой поток

```
POST /auth/telegram      → JWT токен
POST /rooms              → создать комнату
POST /rooms/:code/join   → войти по коду
POST /rooms/:id/start    → запустить матч

WS /ws/match/:matchId    → игровой канал

Клиент → сервер:  { matchId, playerId, intent: { type, ...args } }
Сервер → клиент:  { event: { type, ...data } }
```

## Intent-команды

| Команда | Описание |
|---|---|
| `move_to_node` | Переместиться в узел |
| `resolve_node_action` | Выполнить действие узла |
| `play_card` | Разыграть карту из руки |
| `end_turn` | Завершить ход |
| `reconnect_to_match` | Восстановить соединение |

## Карта MVP

12 узлов, 14 рёбер, 2 ветки (север/юг), 2 хаба.

```
START ─ Рынок Западный ─ Биржа ─ Рынок Северный ─ Архив ─┐
     └─ Склад ─ Перевал ─┘ Квартал ─ Найм ─────────────── Тракт ─ Столичный Порт
                                                                  └─ Восточная Ярмарка
```

## Контент MVP

- **15** контрактов (small / medium / large)
- **8** специалистов (2 тира)
- **25** карт руки
- **4** лицензии
- **3** постройки
- **1** AI профиль (эвристика)

## Деплой на сервер (Docker)

### Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone <repo> caravan-houses && cd caravan-houses

# 2. Создать .env
cp .env.production.example .env
# Заполнить JWT_SECRET и TELEGRAM_BOT_TOKEN

# 3. Запустить
chmod +x deploy.sh
./deploy.sh --build
```

### Что поднимается

| Контейнер | Образ | Порт |
|---|---|---|
| caravan-backend | node:20-alpine | 3000 (внутренний) |
| caravan-frontend | nginx:alpine | 80 → публичный |

Frontend проксирует `/api/*` и `/ws/*` на backend — CORS и конфиг настроены.

### Обновление

```bash
git pull
./deploy.sh        # инкрементальная сборка
./deploy.sh --build # полная пересборка
```

### Логи и управление

```bash
docker compose logs -f backend    # логи бэкенда
docker compose logs -f frontend   # логи nginx
docker compose down               # остановить
docker compose exec backend sh    # войти в контейнер
```

### Для разработки (без Docker)

```bash
# Терминал 1
npm run dev:backend

# Терминал 2
npm run dev:frontend
```

## Acceptance Criteria

Полный список в `docs/qa-test-plan-v1.md`.

Ключевые P0:
- [ ] Запуск из Telegram
- [ ] Матч Solo vs AI запускается и завершается
- [ ] Reconnect восстанавливает состояние
- [ ] Нет softlock'ов
- [ ] Сервер валидирует все действия
