#!/bin/sh
# deploy.sh — деплой на сервер
# Использование: ./deploy.sh [--build]

set -e

# ── Проверки ─────────────────────────────────

if [ ! -f ".env" ]; then
  echo "❌ Файл .env не найден. Скопируйте .env.production.example в .env и заполните."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker не установлен."
  exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  echo "❌ Docker Compose не установлен."
  exit 1
fi

# Команда compose (поддержка старого и нового синтаксиса)
DC="docker compose"
command -v docker-compose >/dev/null 2>&1 && DC="docker-compose"

echo "🚀 Деплой Caravan Houses..."

# ── Сборка ───────────────────────────────────

if [ "$1" = "--build" ] || [ "$1" = "-b" ]; then
  echo "🔨 Сборка образов..."
  $DC build --no-cache
else
  echo "🔨 Сборка образов (инкрементальная)..."
  $DC build
fi

# ── Запуск ───────────────────────────────────

echo "⬆️  Остановка старых контейнеров..."
$DC down --remove-orphans || true

echo "▶️  Запуск контейнеров..."
$DC up -d

# ── Проверка ─────────────────────────────────

echo "⏳ Ожидание запуска backend (30s)..."
sleep 10

RETRIES=6
for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend работает!"
    break
  fi
  if [ $i -eq $RETRIES ]; then
    echo "❌ Backend не ответил за 30 секунд."
    $DC logs backend --tail=50
    exit 1
  fi
  sleep 5
done

echo ""
echo "✅ Деплой завершён!"
echo "   Frontend: http://localhost"
echo "   Backend:  http://localhost:3000/health"
echo ""
echo "📋 Логи: docker compose logs -f"
echo "🛑 Стоп:  docker compose down"
