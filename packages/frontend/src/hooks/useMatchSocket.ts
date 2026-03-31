import { useEffect, useRef, useCallback } from 'react';
import { useNavigate }                     from 'react-router-dom';
import type { Intent, ServerEvent }        from '@caravan/shared';
import { useMatchStore }                   from '../store/matchStore.js';

// Строим WS URL из VITE_API_URL: https://... → wss://...
function getWsBase(): string {
  const apiUrl = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  if (apiUrl) {
    return apiUrl.replace(/^http/, 'ws');
  }
  // Fallback: тот же хост что и страница
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}`;
}

type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function useMatchSocket(matchId: string, playerId: string) {
  const wsRef    = useRef<WebSocket | null>(null);
  const navigate = useNavigate();
  const {
    setMatchState, applyDiff, setAiThinking, addToast, openModal,
  } = useMatchStore();

  const sendIntent = useCallback((intent: Intent) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      addToast({ type: 'error', message: 'Нет соединения с сервером' });
      return;
    }
    ws.send(JSON.stringify({ matchId, playerId, intent }));
  }, [matchId, playerId]);

  useEffect(() => {
    const ws = new WebSocket(`${getWsBase()}/ws/match/${matchId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Reconnect при подключении
      ws.send(JSON.stringify({
        matchId, playerId,
        intent: { type: 'reconnect_to_match', matchId },
      }));
    };

    ws.onmessage = (e) => {
      try {
        const { event } = JSON.parse(e.data) as { event: ServerEvent };
        handleEvent(event);
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    ws.onerror = () => {
      addToast({ type: 'error', message: 'Ошибка соединения' });
    };

    ws.onclose = () => {
      addToast({ type: 'info', message: 'Соединение разорвано. Переподключение...' });
    };

    return () => { ws.close(); };
  }, [matchId, playerId]);

  function handleEvent(event: ServerEvent) {
    switch (event.type) {

      case 'match_started':
      case 'reconnect_ok':
        setMatchState(event.state);
        break;

      case 'state_diff':
        applyDiff(event.diff);
        break;

      case 'node_activated':
        // Открыть модал действия узла
        openModal('node_action');
        break;

      case 'delivery_completed':
        addToast({
          type: 'success',
          message: `Доставка: +${event.reward.gold}💰 +${event.reward.score}⭐`,
        });
        break;

      case 'match_finished':
        navigate(`/results/${matchId}`, { state: { results: event.results } });
        break;

      case 'ai_thinking':
        setAiThinking(true);
        break;

      case 'ai_done':
        setAiThinking(false);
        break;

      case 'error':
        addToast({ type: 'error', message: event.message });
        break;
    }
  }

  return { sendIntent };
}
