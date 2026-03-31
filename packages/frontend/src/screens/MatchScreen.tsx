import React, { useCallback } from 'react';
import { useParams }            from 'react-router-dom';
import { useMatchSocket }       from '../hooks/useMatchSocket.js';
import { useMatchStore, useMyPlayer, useIsMyTurn } from '../store/matchStore.js';
import { MapView }              from '../components/map/MapView.js';
import { NodeActionModal }      from '../components/modals/NodeActionModal.js';
import { DeliveryModal }        from '../components/modals/DeliveryModal.js';
import { HandDrawer }           from '../components/modals/HandDrawer.js';
import { ToastStack }           from '../components/ui/ToastStack.js';
import mapMvp                   from '../../../backend/src/data/maps/map-mvp.json';
import type { MapData }         from '@caravan/shared';

const MAP_DATA = mapMvp as unknown as MapData;

// ─────────────────────────────────────────────
//  MATCH SCREEN
// ─────────────────────────────────────────────

export function MatchScreen() {
  const { matchId = '' }  = useParams<{ matchId: string }>();
  const playerId           = localStorage.getItem('playerId') ?? '';
  const { sendIntent }     = useMatchSocket(matchId, playerId);

  const { matchState, availableNodes, activeModal, aiThinking,
          openModal, setSelectedNode, selectedNodeId } = useMatchStore();
  const myPlayer  = useMyPlayer();
  const isMyTurn  = useIsMyTurn();

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!isMyTurn || !availableNodes.includes(nodeId)) return;
    setSelectedNode(nodeId);
    sendIntent({ type: 'move_to_node', nodeId });
  }, [isMyTurn, availableNodes, sendIntent]);

  const handleEndTurn = () => sendIntent({ type: 'end_turn' });

  if (!matchState || !myPlayer) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">⚙️</div>
          <p>Подключение к матчу...</p>
        </div>
      </div>
    );
  }

  const activePlayer = matchState.players[matchState.activePlayerId];
  const phase        = matchState.turnPhase;

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">

      {/* ── HEADER ── */}
      <header className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-400">
            Раунд {matchState.round}/{matchState.maxRounds}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
            isMyTurn ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'
          }`}>
            {isMyTurn ? '⚡ Ваш ход' : `Ход: ${activePlayer?.displayName}`}
          </span>
        </div>

        {/* Ресурсы моего игрока */}
        <div className="flex gap-3 text-sm">
          <Resource icon="💰" value={myPlayer.resources.gold} />
          <Resource icon="🌟" value={myPlayer.resources.influence} />
          <Resource icon="📦" value={myPlayer.resources.cargo} />
          <Resource icon="⭐" value={myPlayer.score} label="очков" />
          {myPlayer.resources.licenses.length > 0 && (
            <span className="text-xs text-yellow-400">
              🏷️ ×{myPlayer.resources.licenses.length}
            </span>
          )}
        </div>
      </header>

      {/* ── AI THINKING BANNER ── */}
      {aiThinking && (
        <div className="bg-blue-800 text-center text-sm py-1 flex-shrink-0">
          🤖 AI думает...
        </div>
      )}

      {/* ── MAP ── */}
      <main className="flex-1 overflow-hidden p-2 relative">
        <MapView mapData={MAP_DATA} onNodeClick={handleNodeClick} />

        {/* Подсказка фазы */}
        {isMyTurn && phase === 'move' && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2
                          bg-black/70 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
            Выберите узел для перемещения
          </div>
        )}
      </main>

      {/* ── ACTION BAR ── */}
      <footer className="px-4 py-3 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <div className="flex gap-3">
          <button
            onClick={() => openModal('hand')}
            className="flex-1 py-2 rounded-lg bg-purple-700 hover:bg-purple-600
                       text-sm font-medium transition-colors"
          >
            🃏 Карты ({myPlayer.hand.length})
          </button>
          <button
            onClick={handleEndTurn}
            disabled={!isMyTurn || phase === 'move'}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed
                       bg-green-600 hover:bg-green-500 disabled:bg-gray-700"
          >
            ✅ Завершить ход
          </button>
        </div>
      </footer>

      {/* ── MODALS ── */}
      {activeModal === 'node_action' && (
        <NodeActionModal sendIntent={sendIntent} mapData={MAP_DATA} />
      )}
      {activeModal === 'delivery' && (
        <DeliveryModal sendIntent={sendIntent} />
      )}
      {activeModal === 'hand' && (
        <HandDrawer sendIntent={sendIntent} />
      )}

      {/* ── TOASTS ── */}
      <ToastStack />
    </div>
  );
}

function Resource({ icon, value, label }: { icon: string; value: number; label?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span>{icon}</span>
      <span className="font-bold">{value}</span>
      {label && <span className="text-gray-400 text-xs">{label}</span>}
    </span>
  );
}
