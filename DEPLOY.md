# Деплой: Railway (бэкенд) + Vercel (фронтенд)

## Схема

```
Telegram Bot
     │
     ▼
[Vercel] React фронтенд
     │  HTTP API  │  WebSocket
     ▼            ▼
[Railway] Node.js бэкенд + SQLite
```

---

## Шаг 1 — Залить код на GitHub

```bash
# Распаковать архив
tar -xzf caravan-houses-final.tar.gz
cd caravan-houses

# Инициализировать git и залить
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/caravan-houses.git
git push -u origin main
```

---

## Шаг 2 — Задеплоить бэкенд на Railway

1. Открыть **railway.app** → New Project → **Deploy from GitHub repo**
2. Выбрать репозиторий `caravan-houses`
3. Railway автоматически найдёт `railway.json` и `nixpacks.toml`
4. После деплоя перейти в **Variables** и добавить:

| Переменная | Значение |
|---|---|
| `JWT_SECRET` | любая длинная случайная строка (мин. 32 символа) |
| `TELEGRAM_BOT_TOKEN` | токен от @BotFather |
| `FRONTEND_URL` | пока пропустить, заполнить после Vercel |
| `NODE_ENV` | `production` |

5. Перейти в **Settings → Networking** → нажать **Generate Domain**
6. Скопировать URL вида `https://caravan-xxx.up.railway.app` — он понадобится для фронтенда

> ⚠️ **Важно:** Railway даёт бесплатный план с лимитом $5/мес (≈500 часов). Для постоянного продакшена нужен платный план.

### Проверить что бэкенд работает

Открыть в браузере: `https://caravan-xxx.up.railway.app/health`

Должно вернуть: `{"ok":true,"ts":...}`

---

## Шаг 3 — Задеплоить фронтенд на Vercel

1. Открыть **vercel.com** → Add New Project → Import из GitHub
2. Выбрать репозиторий `caravan-houses`
3. Vercel найдёт `vercel.json` автоматически
4. В разделе **Environment Variables** добавить:

| Переменная | Значение |
|---|---|
| `VITE_API_URL` | `https://caravan-xxx.up.railway.app` (URL с Railway) |

5. Нажать **Deploy**
6. После деплоя скопировать URL вида `https://caravan-houses.vercel.app`

---

## Шаг 4 — Прописать FRONTEND_URL на Railway

1. Вернуться в Railway → Variables
2. Добавить переменную:

| Переменная | Значение |
|---|---|
| `FRONTEND_URL` | `https://caravan-houses.vercel.app` (URL с Vercel) |

3. Railway автоматически перезапустит сервис

---

## Шаг 5 — Создать Telegram бота

1. Написать @BotFather в Telegram
2. `/newbot` → задать имя → получить токен
3. `/newapp` → привязать Web App к боту → указать URL фронтенда с Vercel
4. Токен уже прописан в Railway Variables на шаге 2

---

## Шаг 6 — Проверить

1. Открыть бота в Telegram → нажать кнопку запуска Web App
2. Должен открыться фронтенд, пройти авторизацию
3. Нажать «Играть с AI» → матч должен запуститься

---

## Обновление кода

```bash
# После изменений
git add .
git commit -m "fix: описание изменений"
git push

# Railway и Vercel подхватят изменения автоматически
```

---

## Возможные проблемы

### CORS ошибка в браузере
- Проверить что `FRONTEND_URL` в Railway совпадает с URL Vercel (без слеша в конце)
- В Vercel проверить что `VITE_API_URL` без слеша в конце

### WebSocket не подключается
- Railway поддерживает WebSocket — проверить что домен именно `*.up.railway.app`, не кастомный (для кастомного нужно включить WebSocket в настройках)
- В браузере открыть DevTools → Network → WS — посмотреть на ошибку

### Backend не стартует на Railway
- Открыть Logs в Railway — посмотреть ошибку
- Чаще всего: не заполнен `JWT_SECRET` или `TELEGRAM_BOT_TOKEN`

### SQLite на Railway
Railway **не** имеет persistent storage на бесплатном плане — данные сбрасываются при рестарте. Для продакшена рекомендуется:
- Платный план Railway с Volume (persistent disk)
- Или заменить SQLite на Railway PostgreSQL (бесплатный аддон)

---

## Структура переменных окружения

### Railway (бэкенд)
```
NODE_ENV=production
JWT_SECRET=<длинная случайная строка>
TELEGRAM_BOT_TOKEN=<токен от BotFather>
FRONTEND_URL=https://your-app.vercel.app
DATABASE_PATH=./data/caravan.db
```

### Vercel (фронтенд)
```
VITE_API_URL=https://your-backend.up.railway.app
```
