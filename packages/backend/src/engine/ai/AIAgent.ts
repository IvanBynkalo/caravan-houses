import type { MatchState, NodeAction } from '@caravan/shared';
import { getAvailableNodes } from '../match/RouteValidator.js';
import { getGameCatalog } from '../cards/CatalogLoader.js';
import { getNodeById, loadMap } from '../map/MapLoader.js';

// ─────────────────────────────────────────────
//  ВЫБОР ХОДА AI
// ─────────────────────────────────────────────

export function aiChooseMove(state: MatchState, playerId: string): string {
  const player   = state.players[playerId]!;
  const map      = loadMap(state.mapId);
  const available = getAvailableNodes(state, playerId);

  if (available.length === 0) {
    // Не должно случаться, но fallback
    return player.currentNodeId;
  }

  const catalog = getGameCatalog();

  // Приоритеты (score каждого узла):
  const scored = available.map(nodeId => {
    const node = getNodeById(map, nodeId);
    let priority = 0;

    // 1. Хаб + контракт + груз → высший приоритет
    if (node.type === 'hub') {
      const canDeliver = player.activeContracts.some(cId => {
        const contract = catalog.contracts[cId];
        if (!contract) return false;
        if (player.resources.cargo < contract.required_cargo) return false;
        if (contract.required_license &&
            !player.resources.licenses.includes(contract.required_license)) return false;
        return true;
      });
      priority = canDeliver ? 100 : 20;
    }

    // 2. Склад, если мало груза и есть контракт
    if (node.type === 'warehouse' && player.resources.cargo === 0) {
      priority = 80;
    }

    // 3. Рынок — если мало золота
    if (node.type === 'market' && player.resources.gold < 4) {
      priority = 60;
    }

    // 4. Архив — если есть деньги и нет лицензий
    if (node.type === 'archive' &&
        player.resources.licenses.length === 0 &&
        player.resources.gold >= 3) {
      priority = 50;
    }

    // 5. Найм — если есть деньги
    if (node.type === 'hire' && player.resources.gold >= 3) {
      priority = 40;
    }

    // 6. Рискованный — если есть защита
    if (node.type === 'risky') {
      priority = player.specialists.includes('s_004') ? 35 : 15;
    }

    // 7. Строительный слот — в конце игры
    if (node.type === 'build_slot' && player.resources.gold >= 4) {
      priority = 30;
    }

    // Небольшая рандомизация, чтобы AI не был полностью предсказуемым
    priority += Math.random() * 5;

    return { nodeId, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  return scored[0]!.nodeId;
}

// ─────────────────────────────────────────────
//  ВЫБОР ДЕЙСТВИЯ НА УЗЛЕ
// ─────────────────────────────────────────────

export function aiChooseAction(
  state: MatchState,
  playerId: string,
): NodeAction {
  const player  = state.players[playerId]!;
  const map     = loadMap(state.mapId);
  const nodeId  = player.currentNodeId;
  const node    = getNodeById(map, nodeId);
  const catalog = getGameCatalog();

  switch (node.type) {

    case 'market': {
      // Предпочесть контракт если его нет и есть место
      if (player.activeContracts.length < 2 && player.resources.cargo > 0) {
        const actionDef = node.actions.find(a => a.kind === 'market' && (a as any).choice === 'contract');
        if (actionDef) return { kind: 'market', choice: 'contract' };
      }
      return { kind: 'market', choice: 'gold' };
    }

    case 'warehouse': {
      return { kind: 'warehouse' };
    }

    case 'hire': {
      const actionDef = node.actions.find(a => a.kind === 'hire');
      const pool = (actionDef as any)?.pool ?? 'tier_1';
      const tier  = pool === 'tier_1' ? 1 : 2;
      // Выбрать первого доступного специалиста нужного тира
      const candidate = Object.values(catalog.specialists)
        .find(s => s.tier === tier && !player.specialists.includes(s.id));
      if (candidate && player.resources.gold >= candidate.cost_gold) {
        return { kind: 'hire', specialistId: candidate.id };
      }
      return { kind: 'skip' };
    }

    case 'archive': {
      // Взять самую дешёвую доступную лицензию
      const archiveActions = node.actions
        .filter(a => a.kind === 'archive') as Array<{ kind: 'archive'; licenseId: string; cost: { gold: number }; requires?: string }>;
      const affordable = archiveActions
        .filter(a => {
          if (player.resources.licenses.includes(a.licenseId)) return false;
          if (a.requires && !player.resources.licenses.includes(a.requires)) return false;
          return player.resources.gold >= a.cost.gold;
        })
        .sort((a, b) => a.cost.gold - b.cost.gold);
      if (affordable.length > 0) {
        return { kind: 'archive', licenseId: affordable[0]!.licenseId };
      }
      return { kind: 'skip' };
    }

    case 'build_slot': {
      const buildActions = node.actions
        .filter(a => a.kind === 'build') as Array<{ kind: 'build'; buildingId: string; cost: { gold: number } }>;
      const nodeState = state.nodes[nodeId];
      if (!nodeState?.buildingId) {
        const affordable = buildActions
          .filter(a => player.resources.gold >= a.cost.gold)
          .sort((a, b) => a.cost.gold - b.cost.gold);
        if (affordable.length > 0) {
          return { kind: 'build', buildingId: affordable[0]!.buildingId };
        }
      }
      return { kind: 'skip' };
    }

    case 'risky': {
      // Всегда рискуем (AI смелый)
      return { kind: 'risky', proceed: true };
    }

    case 'hub': {
      // Попробовать доставить
      const deliverable = player.activeContracts.find(cId => {
        const contract = catalog.contracts[cId];
        if (!contract) return false;
        if (player.resources.cargo < contract.required_cargo) return false;
        if (contract.required_license &&
            !player.resources.licenses.includes(contract.required_license)) return false;
        return true;
      });
      if (deliverable) {
        return { kind: 'hub', subAction: 'deliver', contractId: deliverable };
      }
      // Иначе взять контракт
      const available = state.contractPool
        .filter(id => !player.activeContracts.includes(id));
      if (available.length > 0 && player.activeContracts.length < 2) {
        return { kind: 'hub', subAction: 'take_contract', contractId: available[0]! };
      }
      return { kind: 'skip' };
    }

    default:
      return { kind: 'skip' };
  }
}
