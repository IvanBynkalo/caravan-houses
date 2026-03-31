import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams }              from 'react-router-dom';
import { api }                                 from '../lib/api.js';

type LobbyPlayer = { userId: string; displayName: string; seatIndex: number };

type LobbyState = {
  roomId:  string;
  code:    string;
  status:  string;
  hostId:  string;
  players: LobbyPlayer[];
};

export function LobbyScreen() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const navigate         = useNavigate();
  const wsRef            = useRef<WebSocket | null>(null);

  const [lobby,   setLobby]   = useState<LobbyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const myId = localStorage.getItem('playerId') ?? '';

  // ── Lobby WebSocket ──────────────────────────
  useEffect(() => {
    const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
    const wsBase = apiUrl
      ? apiUrl.replace(/^http/, 'ws')
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
    const ws = new WebSocket(`${wsBase}/ws/lobby/${roomId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'lobby_state') {
          setLobby(msg as LobbyState);
          // Если матч уже стартовал — перейти на MatchScreen
          if (msg.status === 'started') {
            navigate(`/match/${msg.roomId}`);
          }
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      // Fallback на HTTP поллинг при ошибке WS
      startPolling();
    };

    return () => { ws.close(); };
  }, [roomId]);

  // ── Fallback: HTTP поллинг ───────────────────
  function startPolling() {
    const poll = async () => {
      try {
        const data = await api.get<LobbyState>(`/rooms/${roomId}/lobby`);
        setLobby(data);
        if (data.status === 'started') navigate(`/match/${roomId}`);
      } catch { /* ignore */ }
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }

  // ── Handlers ────────────────────────────────
  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const { matchId } = await api.post<{ matchId: string }>(`/rooms/${roomId}/start`, {});
      navigate(`/match/${matchId}`);
    } catch (e: any) {
      setError(e.message ?? 'Ошибка запуска');
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (lobby?.code) navigator.clipboard.writeText(lobby.code).catch(() => {});
  };

  const isHost   = lobby?.hostId === myId;
  const canStart = isHost && (lobby?.players.length ?? 0) >= 1;

  // ── Render ──────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white px-4 py-8">

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 text-xl">←</button>
        <h1 className="text-xl font-bold">Комната</h1>
      </div>

      {/* Код */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6 text-center border border-gray-700">
        <p className="text-xs text-gray-400 mb-1">Код комнаты</p>
        <p className="text-3xl font-mono font-bold tracking-widest text-yellow-400">
          {lobby?.code ?? '······'}
        </p>
        <button onClick={handleCopy} className="mt-2 text-xs text-gray-400 hover:text-white">
          📋 Скопировать
        </button>
      </div>

      {/* Игроки */}
      <div className="mb-6">
        <p className="text-sm text-gray-400 mb-2">
          Игроки ({lobby?.players.length ?? 0}/2):
        </p>
        <div className="space-y-2">
          {(lobby?.players ?? []).map((p, i) => (
            <div key={p.userId}
              className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3 border border-gray-700">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center
                              justify-center text-sm font-bold flex-shrink-0">
                {p.displayName[0]?.toUpperCase()}
              </div>
              <span className="font-medium">{p.displayName}</span>
              {i === 0 && (
                <span className="ml-auto text-xs bg-yellow-700 text-yellow-200 px-2 py-0.5 rounded">
                  Хост
                </span>
              )}
              {p.userId === myId && (
                <span className="ml-1 text-xs text-gray-500">(вы)</span>
              )}
            </div>
          ))}

          {(lobby?.players.length ?? 0) < 2 && (
            <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-3
                            border border-dashed border-gray-600">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center
                              justify-center text-gray-500 text-sm">?</div>
              <span className="text-gray-500 text-sm">Ожидание игрока...</span>
            </div>
          )}
        </div>
      </div>

      {isHost && (lobby?.players.length ?? 0) === 1 && (
        <p className="text-xs text-gray-500 text-center mb-4">
          Можно начать соло — AI заменит второго игрока
        </p>
      )}

      {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

      <button
        onClick={handleStart}
        disabled={!canStart || loading}
        className="w-full py-4 rounded-xl font-bold text-base transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed
                   bg-green-600 hover:bg-green-500"
      >
        {loading        ? '⏳ Запуск...'
          : isHost      ? '🚀 Начать игру'
          : '⏳ Ожидание хоста...'}
      </button>
    </div>
  );
}
