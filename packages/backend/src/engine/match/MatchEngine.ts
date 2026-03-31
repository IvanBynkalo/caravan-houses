import type {
  MatchState, PlayerState, NodeState, StateDiff,
} from '@caravan/shared';
import { loadMap, getStartNode } from '../map/MapLoader.js';
import { drawCards, getContractsByTier } from '../cards/CatalogLoader.js';
import { getReachableNodes } from '../map/MapLoader.js';
import { config } from '../../config.js';
import { nanoid } from '../../utils/nanoid.js';

// ─────────────────────────────────────────────
//  ФАБРИКА: создание нового матча
// ─────────────────────────────────────────────

export type CreateMatchOptions = {
  matchId?: string;
  mapId:    string;
  players:  Array<{ id: string; displayName: string; isAI?: boolean }>;
  maxRounds?: number;
};

export function createMatch(opts: CreateMatchOptions): MatchState {
  const matchId = opts.matchId ?? nanoid();
  const map     = loadMap(opts.mapId);
  const start   = getStartNode(map);

  // Начальный пул контрактов: все small + medium + первые 2 large
  const contractPool: string[] = [
    ...getContractsByTier('small'),
    ...getContractsByTier('medium'),
    ...getContractsByTier('large').slice(0, 2),
  ];

  // Инициализация узлов
  const nodes: Record<string, NodeState> = {};
  for (const node of map.nodes) {
    nodes[node.id] = {
      id:          node.id,
      status:      node.id === start.id ? 'activated' : 'inactive',
      occupiedBy:  [],
    };
  }

  // Инициализация игроков
  const players: Record<string, PlayerState> = {};
  const turnOrder: string[] = [];

  // Раздаём стартовые контракты — каждому игроку уникальный
  const smallPool = [...getContractsByTier('small')].sort(() => Math.random() - 0.5);
  const usedStartContracts: string[] = [];

  for (let i = 0; i < opts.players.length; i++) {
    const p = opts.players[i]!;

    // Уникальный стартовый контракт
    const startContract = smallPool.find(id => !usedStartContracts.includes(id))
      ?? smallPool[0]!;
    usedStartContracts.push(startContract);

    // Стартовые карты — только opportunity (не house_privilege)
    const startHand = drawCards(config.startCards, []);

    players[p.id] = {
      id:                  p.id,
      displayName:         p.displayName,
      isAI:                p.isAI ?? false,
      currentNodeId:       start.id,
      resources: {
        gold:      config.startGold,
        influence: 0,
        cargo:     config.startCargo,
        licenses:  [],
      },
      hand:                startHand,
      activeContracts:     [startContract],
      completedContracts:  [],
      specialists:         [],
      buildings:           [],
      score:               0,
      deliveriesCompleted: 0,
      logistUsedThisCycle: false,
    };

    nodes[start.id]!.occupiedBy.push(p.id);
    turnOrder.push(p.id);
  }

  const firstPlayer = turnOrder[0]!;

  const state: MatchState = {
    id:            matchId,
    status:        'active',
    round:         1,
    maxRounds:     opts.maxRounds ?? config.maxRounds,
    turnOrder,
    activePlayerId: firstPlayer,
    turnPhase:     'move',
    players,
    nodes,
    contractPool,
    usedContracts: [],
    eventLog:      [],
    mapId:         opts.mapId,
  };

  return markAvailableNodes(state, firstPlayer);
}

// ─────────────────────────────────────────────
//  ПОДСВЕТКА ДОСТУПНЫХ УЗЛОВ
// ─────────────────────────────────────────────

export function markAvailableNodes(state: MatchState, playerId: string): MatchState {
  const player = state.players[playerId];
  if (!player) return state;

  const map = loadMap(state.mapId);

  // Вычислить модификаторы движения без импорта RouteValidator (чтобы не было цикла)
  let extraSteps = 0;
  if (player.specialists.includes('s_008')) extraSteps += 1; // Картограф
  if (player.specialists.includes('s_001') && !player.logistUsedThisCycle) extraSteps += 1;

  const maxSteps = config.moveMax + extraSteps;
  const available = getReachableNodes(map, player.currentNodeId, maxSteps);

  const nodes = { ...state.nodes };
  for (const nodeId of Object.keys(nodes)) {
    const n = nodes[nodeId]!;
    if (available.includes(nodeId) && n.status !== 'blocked') {
      nodes[nodeId] = { ...n, status: 'available' };
    } else if (n.status === 'available') {
      nodes[nodeId] = { ...n, status: n.occupiedBy.length > 0 ? 'occupied' : 'inactive' };
    }
  }

  return { ...state, nodes };
}

// ─────────────────────────────────────────────
//  ПРИМЕНИТЬ DIFF К STATE
// ─────────────────────────────────────────────

export function applyDiff(state: MatchState, diff: StateDiff): MatchState {
  let next = { ...state };

  if (diff.players) {
    next.players = { ...next.players };
    for (const [id, partial] of Object.entries(diff.players)) {
      if (partial) {
        next.players[id] = { ...next.players[id]!, ...partial } as PlayerState;
      }
    }
  }

  if (diff.nodes) {
    next.nodes = { ...next.nodes };
    for (const [id, partial] of Object.entries(diff.nodes)) {
      if (partial) {
        next.nodes[id] = { ...next.nodes[id]!, ...partial } as NodeState;
      }
    }
  }

  if (diff.contractPool  !== undefined) next.contractPool  = diff.contractPool;
  if (diff.usedContracts !== undefined) next.usedContracts = diff.usedContracts;
  if (diff.round         !== undefined) next.round         = diff.round;
  if (diff.activePlayerId!== undefined) next.activePlayerId= diff.activePlayerId;
  if (diff.turnPhase     !== undefined) next.turnPhase     = diff.turnPhase;
  if (diff.status        !== undefined) next.status        = diff.status;
  if (diff.winner        !== undefined) next.winner        = diff.winner;

  if (diff.eventLog && diff.eventLog.length > 0) {
    next.eventLog = [...next.eventLog, ...diff.eventLog];
  }

  return next;
}

// ─────────────────────────────────────────────
//  ПРОВЕРКА УСЛОВИЯ ОКОНЧАНИЯ
// ─────────────────────────────────────────────

export function isMatchOver(state: MatchState): boolean {
  if (state.status === 'finished') return true;
  // Все игроки сделали ход = конец раунда
  // Раунды считаются в TurnEngine
  return false;
}

// ─────────────────────────────────────────────
//  СЕРИАЛИЗАЦИЯ
// ─────────────────────────────────────────────

export function serializeState(state: MatchState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): MatchState {
  return JSON.parse(json) as MatchState;
}
