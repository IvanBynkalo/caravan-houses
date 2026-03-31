import React           from 'react';
import type { Intent, MapData, NodeAction } from '@caravan/shared';
import { useMatchStore, useMyPlayer }        from '../../store/matchStore.js';
import { getNodeById }                       from '../../../../backend/src/engine/map/MapLoader.js';
import gamedata                              from '../../../../backend/src/data/gamedata.json';

type Props = { sendIntent: (i: Intent) => void; mapData: MapData };

export function NodeActionModal({ sendIntent, mapData }: Props) {
  const { matchState, closeModal } = useMatchStore();
  const myPlayer = useMyPlayer();
  if (!matchState || !myPlayer) return null;

  const nodeId   = myPlayer.currentNodeId;
  const nodeData = mapData.nodes.find(n => n.id === nodeId);
  if (!nodeData) return null;

  const nodeState = matchState.nodes[nodeId];

  function send(action: NodeAction) {
    sendIntent({ type: 'resolve_node_action', action });
    closeModal();
  }

  function skip() {
    send({ kind: 'skip' });
  }

  return (
    <BottomSheet onClose={skip}>
      <h2 className="text-lg font-bold mb-1">{nodeData.label}</h2>
      <div className="text-sm text-gray-400 mb-4 capitalize">{nodeData.type.replace('_', ' ')}</div>

      {nodeData.type === 'market'     && <MarketActions    nodeData={nodeData} player={myPlayer} send={send} />}
      {nodeData.type === 'warehouse'  && <WarehouseActions player={myPlayer} send={send} />}
      {nodeData.type === 'hire'       && <HireActions      nodeData={nodeData} player={myPlayer} matchState={matchState} send={send} />}
      {nodeData.type === 'archive'    && <ArchiveActions   nodeData={nodeData} player={myPlayer} send={send} />}
      {nodeData.type === 'build_slot' && <BuildActions     nodeData={nodeData} player={myPlayer} nodeState={nodeState} send={send} />}
      {nodeData.type === 'risky'      && <RiskyActions     send={send} />}
      {nodeData.type === 'hub'        && <HubActions       player={myPlayer} matchState={matchState} send={send} />}

      <button onClick={skip} className="w-full mt-3 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm">
        Пропустить
      </button>
    </BottomSheet>
  );
}

// ─── Market ──────────────────────────────────
function MarketActions({ nodeData, player, send }: any) {
  return (
    <div className="space-y-2">
      {nodeData.actions.map((a: any, i: number) => {
        if (a.choice === 'exchange' && player.resources.cargo < (a.cost?.cargo ?? 2)) return null;
        return (
          <ActionBtn key={i} onClick={() => send({ kind: 'market', choice: a.choice })}>
            {a.label}
          </ActionBtn>
        );
      })}
    </div>
  );
}

// ─── Warehouse ───────────────────────────────
function WarehouseActions({ player, send }: any) {
  const full = player.resources.cargo >= 3;
  return (
    <ActionBtn disabled={full} onClick={() => send({ kind: 'warehouse' })}>
      {full ? '📦 Склад полон (лимит 3)' : '📦 Получить грузовую партию'}
    </ActionBtn>
  );
}

// ─── Hire ────────────────────────────────────
function HireActions({ nodeData, player, matchState, send }: any) {
  const pool = nodeData.actions[0]?.pool ?? 'tier_1';
  const tier = pool === 'tier_1' ? 1 : 2;
  const catalog = (gamedata as any).specialists as any[];
  const candidates = catalog
    .filter((s: any) => s.tier === tier && !player.specialists.includes(s.id))
    .slice(0, 2);

  if (candidates.length === 0) {
    return <p className="text-gray-400 text-sm">Нет доступных специалистов</p>;
  }

  return (
    <div className="space-y-2">
      {candidates.map((s: any) => (
        <div key={s.id} className="rounded-lg bg-gray-700 p-3">
          <div className="flex justify-between items-start mb-1">
            <span className="font-semibold">{s.name}</span>
            <span className="text-yellow-400 text-sm">💰{s.cost_gold}</span>
          </div>
          <p className="text-gray-400 text-xs mb-2">{s.description}</p>
          <ActionBtn
            disabled={player.resources.gold < s.cost_gold}
            onClick={() => send({ kind: 'hire', specialistId: s.id })}
          >
            {player.resources.gold < s.cost_gold ? `Нужно ${s.cost_gold}💰` : 'Нанять'}
          </ActionBtn>
        </div>
      ))}
    </div>
  );
}

// ─── Archive ─────────────────────────────────
function ArchiveActions({ nodeData, player, send }: any) {
  return (
    <div className="space-y-2">
      {nodeData.actions.map((a: any, i: number) => {
        const owned  = player.resources.licenses.includes(a.licenseId);
        const missPre = a.requires && !player.resources.licenses.includes(a.requires);
        const tooExp = player.resources.gold < (a.cost?.gold ?? 99);
        const disabled = owned || missPre || tooExp;
        const label = owned ? `${a.label} ✓` :
                      missPre ? `${a.label} (нужна ${a.requires})` : a.label;
        return (
          <ActionBtn key={i} disabled={disabled}
            onClick={() => send({ kind: 'archive', licenseId: a.licenseId })}>
            {label}
          </ActionBtn>
        );
      })}
    </div>
  );
}

// ─── Build ───────────────────────────────────
function BuildActions({ nodeData, player, nodeState, send }: any) {
  if (nodeState?.buildingId) {
    return <p className="text-gray-400 text-sm">Слот занят: уже построено здание</p>;
  }
  return (
    <div className="space-y-2">
      {nodeData.actions.map((a: any, i: number) => (
        <ActionBtn key={i}
          disabled={player.resources.gold < (a.cost?.gold ?? 99)}
          onClick={() => send({ kind: 'build', buildingId: a.buildingId })}>
          {a.label}
        </ActionBtn>
      ))}
    </div>
  );
}

// ─── Risky ───────────────────────────────────
function RiskyActions({ send }: any) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-400 mb-2">Опасный маршрут. Исход случаен.</p>
      <ActionBtn onClick={() => send({ kind: 'risky', proceed: true })}>🎲 Рискнуть</ActionBtn>
    </div>
  );
}

// ─── Hub ─────────────────────────────────────
function HubActions({ player, matchState, send }: any) {
  const catalog    = (gamedata as any).contracts as any[];
  const contractMap = Object.fromEntries(catalog.map((c: any) => [c.id, c]));

  const deliverable = player.activeContracts.filter((cId: string) => {
    const c = contractMap[cId];
    if (!c) return false;
    if (player.resources.cargo < c.required_cargo) return false;
    if (c.required_license && !player.resources.licenses.includes(c.required_license)) return false;
    return true;
  });

  const available = matchState.contractPool
    .filter((id: string) => !player.activeContracts.includes(id))
    .slice(0, 3);

  return (
    <div className="space-y-3">
      {deliverable.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Доставить:</p>
          {deliverable.map((cId: string) => {
            const c = contractMap[cId];
            return (
              <div key={cId} className="rounded-lg bg-green-900/50 border border-green-700 p-3 mb-2">
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Награда: 💰{c.reward_gold} 🌟{c.reward_influence} ⭐{c.reward_score}
                </div>
                <ActionBtn className="mt-2" onClick={() => send({ kind: 'hub', subAction: 'deliver', contractId: cId })}>
                  ✅ Доставить
                </ActionBtn>
              </div>
            );
          })}
        </div>
      )}
      {available.length > 0 && player.activeContracts.length < 3 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Взять контракт:</p>
          {available.map((cId: string) => {
            const c = contractMap[cId];
            if (!c) return null;
            return (
              <div key={cId} className="rounded-lg bg-gray-700 p-2 mb-1">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-gray-400">Нужно: 📦{c.required_cargo} {c.required_license ? `🏷️${c.required_license}` : ''}</div>
                <ActionBtn className="mt-1" onClick={() => send({ kind: 'hub', subAction: 'take_contract', contractId: cId })}>
                  Взять
                </ActionBtn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared UI ───────────────────────────────
function ActionBtn({ onClick, disabled, children, className = '' }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors
        ${disabled
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-500 text-white'
        } ${className}`}
    >
      {children}
    </button>
  );
}

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50
                      bg-gray-800 rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto
                      shadow-xl border-t border-gray-600">
        {children}
      </div>
    </>
  );
}
