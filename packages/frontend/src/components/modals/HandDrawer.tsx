// DeliveryModal.tsx
import React from 'react';
import type { Intent } from '@caravan/shared';
import { useMatchStore, useMyPlayer } from '../../store/matchStore.js';
import gamedata from '../../../../backend/src/data/gamedata.json';

export function DeliveryModal({ sendIntent }: { sendIntent: (i: Intent) => void }) {
  const { closeModal } = useMatchStore();
  const myPlayer = useMyPlayer();
  if (!myPlayer) return null;

  const contractMap = Object.fromEntries(
    (gamedata as any).contracts.map((c: any) => [c.id, c])
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={closeModal} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-800 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">🏛️ Доставка</h2>
        {myPlayer.activeContracts.map(cId => {
          const c = contractMap[cId];
          if (!c) return null;
          const canDeliver = myPlayer.resources.cargo >= c.required_cargo &&
            (!c.required_license || myPlayer.resources.licenses.includes(c.required_license));
          return (
            <div key={cId} className="rounded-lg bg-gray-700 p-3 mb-3">
              <div className="font-semibold">{c.name}</div>
              <div className="text-sm text-gray-400 mt-1">
                Груз: 📦×{c.required_cargo}
                {c.required_license && ` 🏷️ ${c.required_license}`}
              </div>
              <div className="text-sm text-yellow-400 mt-1">
                +💰{c.reward_gold} +🌟{c.reward_influence} +⭐{c.reward_score}
              </div>
              <button
                disabled={!canDeliver}
                onClick={() => {
                  sendIntent({ type: 'resolve_node_action', action: { kind: 'hub', subAction: 'deliver', contractId: cId } });
                  closeModal();
                }}
                className="mt-2 w-full py-2 rounded-lg text-sm font-medium
                  disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed
                  bg-green-600 hover:bg-green-500 text-white"
              >
                {canDeliver ? '✅ Доставить' : '❌ Не выполнить (не хватает ресурсов)'}
              </button>
            </div>
          );
        })}
        <button onClick={closeModal} className="w-full py-2 rounded-lg bg-gray-700 text-gray-300 text-sm">
          Закрыть
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HandDrawer.tsx
// ─────────────────────────────────────────────────────────────

export function HandDrawer({ sendIntent }: { sendIntent: (i: Intent) => void }) {
  const { closeModal } = useMatchStore();
  const myPlayer = useMyPlayer();
  if (!myPlayer) return null;

  const cardMap = Object.fromEntries(
    (gamedata as any).cards.map((c: any) => [c.id, c])
  );

  const hand = myPlayer.hand;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={closeModal} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-800 rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">🃏 Карты ({hand.length})</h2>
          <button onClick={closeModal} className="text-gray-400 text-sm">✕ Закрыть</button>
        </div>

        {hand.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-4">Рука пуста</p>
        )}

        <div className="space-y-2">
          {hand.map(cardId => {
            const card = cardMap[cardId];
            if (!card) return null;
            const isPrivilege = card.type === 'house_privilege';
            return (
              <div key={cardId}
                className={`rounded-lg p-3 border ${isPrivilege
                  ? 'bg-purple-900/50 border-purple-600'
                  : 'bg-gray-700 border-gray-600'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm">{card.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{card.description}</div>
                  </div>
                  {isPrivilege && (
                    <span className="text-xs bg-purple-700 text-purple-200 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                      Пассив
                    </span>
                  )}
                </div>
                {!isPrivilege && (
                  <button
                    onClick={() => {
                      sendIntent({ type: 'play_card', cardId });
                      closeModal();
                    }}
                    className="mt-2 w-full py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    Разыграть
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// ToastStack.tsx
// ─────────────────────────────────────────────────────────────

export function ToastStack() {
  const { toasts, removeToast } = useMatchStore();

  return (
    <div className="fixed top-20 right-3 z-[100] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => removeToast(t.id)}
          className={`pointer-events-auto px-4 py-2 rounded-lg text-sm shadow-lg max-w-[240px]
            ${t.type === 'error'   ? 'bg-red-600 text-white' :
              t.type === 'success' ? 'bg-green-600 text-white' :
                                     'bg-gray-700 text-gray-100'}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
