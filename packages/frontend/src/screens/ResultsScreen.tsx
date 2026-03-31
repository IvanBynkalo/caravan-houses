import React          from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { MatchResults }        from '@caravan/shared';
import { useMatchStore }            from '../store/matchStore.js';

export function ResultsScreen() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { reset } = useMatchStore();

  const results = location.state?.results as MatchResults | undefined;

  const handleMenu = () => {
    reset();
    navigate('/');
  };

  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-4">
        <p className="text-gray-400">Результаты недоступны</p>
        <button onClick={handleMenu} className="px-6 py-2 rounded-lg bg-blue-600 text-sm">
          В меню
        </button>
      </div>
    );
  }

  const winner = results.players[0]!;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white px-4 py-8">
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🏆</div>
        <h1 className="text-2xl font-bold">Итоги партии</h1>
        <p className="text-gray-400 text-sm mt-1">
          Победитель: <span className="text-yellow-400 font-semibold">{winner.displayName}</span>
        </p>
      </div>

      {/* Таблица результатов */}
      <div className="space-y-3 mb-8">
        {results.players.map((p, i) => (
          <div
            key={p.id}
            className={`rounded-xl p-4 border ${
              i === 0
                ? 'bg-yellow-900/40 border-yellow-600'
                : 'bg-gray-800 border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{medals[i] ?? `#${i + 1}`}</span>
                <span className="font-bold">{p.displayName}</span>
              </div>
              <span className="text-xl font-bold text-yellow-400">⭐ {p.score}</span>
            </div>

            {/* Детали */}
            <div className="grid grid-cols-4 gap-1 text-xs text-gray-400">
              <div className="text-center">
                <div className="text-white font-semibold">{p.deliveries}</div>
                <div>доставок</div>
              </div>
              <div className="text-center">
                <div className="text-white font-semibold">{p.contracts}</div>
                <div>контрактов</div>
              </div>
              <div className="text-center">
                <div className="text-white font-semibold">{p.licenses}</div>
                <div>лицензий</div>
              </div>
              <div className="text-center">
                <div className="text-white font-semibold">{p.gold}💰</div>
                <div>золота</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleMenu}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500
                   font-semibold text-base transition-colors"
      >
        В главное меню
      </button>
    </div>
  );
}
