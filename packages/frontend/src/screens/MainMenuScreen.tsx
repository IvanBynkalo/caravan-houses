import React, { useState } from 'react';
import { useNavigate }      from 'react-router-dom';
import { api }              from '../lib/api.js';

// ─────────────────────────────────────────────
//  MAIN MENU
// ─────────────────────────────────────────────

export function MainMenuScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error,   setError]   = useState('');

  const displayName = localStorage.getItem('displayName') ?? 'Гость';

  const handleSolo = async () => {
    setLoading('solo');
    setError('');
    try {
      const { roomId } = await api.post('/rooms', {});
      const { matchId } = await api.post(`/rooms/${roomId}/start`, {});
      navigate(`/match/${matchId}`);
    } catch (e: any) {
      setError(e.message ?? 'Ошибка');
      setLoading(null);
    }
  };

  const handleCreate = async () => {
    setLoading('create');
    setError('');
    try {
      const { roomId } = await api.post('/rooms', {});
      navigate(`/lobby/${roomId}`);
    } catch (e: any) {
      setError(e.message ?? 'Ошибка');
      setLoading(null);
    }
  };

  const handleJoin = () => navigate('/join');

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-4">🏪</div>
        <h1 className="text-3xl font-bold mb-1">Торговые Дома</h1>
        <p className="text-gray-400 text-sm mb-8">Caravan Houses</p>

        {/* Player info */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-full px-4 py-2 mb-10">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center
                          text-sm font-bold">
            {displayName[0]?.toUpperCase()}
          </div>
          <span className="text-sm text-gray-300">{displayName}</span>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-xs space-y-3">
          <MenuButton
            icon="🤖"
            label="Играть с AI"
            loading={loading === 'solo'}
            onClick={handleSolo}
            primary
          />
          <MenuButton
            icon="➕"
            label="Создать игру"
            loading={loading === 'create'}
            onClick={handleCreate}
          />
          <MenuButton
            icon="🔑"
            label="Войти в игру"
            onClick={handleJoin}
          />
        </div>

        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
      </div>

      {/* Footer */}
      <div className="text-center pb-6 text-xs text-gray-600">v0.1.0 MVP</div>
    </div>
  );
}

function MenuButton({ icon, label, onClick, primary, loading }: {
  icon: string; label: string; onClick: () => void;
  primary?: boolean; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className={`w-full py-4 rounded-xl font-semibold text-base flex items-center
                  justify-center gap-3 transition-colors
                  disabled:opacity-60 disabled:cursor-not-allowed
                  ${primary
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                  }`}
    >
      <span className="text-xl">{loading ? '⏳' : icon}</span>
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────
//  JOIN ROOM SCREEN
// ─────────────────────────────────────────────

export function JoinRoomScreen() {
  const navigate   = useNavigate();
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleJoin = async () => {
    if (code.trim().length < 4) { setError('Введите код комнаты'); return; }
    setLoading(true);
    setError('');
    try {
      const { roomId } = await api.post(`/rooms/${code.trim().toUpperCase()}/join`, {});
      navigate(`/lobby/${roomId}`);
    } catch (e: any) {
      setError(e.message ?? 'Комната не найдена');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => navigate('/')} className="text-gray-400 text-xl">←</button>
        <h1 className="text-xl font-bold">Войти в игру</h1>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-xs mx-auto w-full">
        <p className="text-sm text-gray-400 mb-4 text-center">
          Введите код комнаты от друга
        </p>

        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="ABC123"
          maxLength={6}
          className="w-full text-center text-3xl font-mono tracking-widest
                     bg-gray-800 border border-gray-600 rounded-xl py-4 px-4
                     text-white placeholder-gray-600 focus:outline-none
                     focus:border-blue-500 uppercase mb-6"
        />

        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={loading || code.length < 4}
          className="w-full py-4 rounded-xl font-bold bg-green-600 hover:bg-green-500
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '⏳ Подключение...' : '🚪 Войти'}
        </button>
      </div>
    </div>
  );
}
