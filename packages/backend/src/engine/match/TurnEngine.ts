import type { MatchState, StateDiff, EventLogEntry } from '@caravan/shared';
import { applyDiff, markAvailableNodes, serializeState } from './MatchEngine.js';
import { buildMatchResults } from './ScoringEngine.js';
import { getNodeById, loadMap } from '../map/MapLoader.js';
import { nanoid } from '../../utils/nanoid.js';

// ─────────────────────────────────────────────
//  ПЕРЕМЕСТИТЬ ИГРОКА
// ─────────────────────────────────────────────

export function applyMove(
  state: MatchState,
  playerId: string,
  targetNodeId: string,
): { state: MatchState; diff: StateDiff } {
  const player = state.players[playerId]!;
  const fromNodeId = player.currentNodeId;

  const logs: EventLogEntry[] = [{
    id: nanoid(),
    round: state.round,
    playerId,
    type: 'move',
    description: `${player.displayName} → ${targetNodeId}`,
    timestamp: Date.now(),
  }];

  // Обновить позицию
  const updatedPlayer = {
    ...player,
    currentNodeId: targetNodeId,
    // Если логист использован — помечаем
    logistUsedThisCycle: player.specialists.includes('s_001') &&
      !player.logistUsedThisCycle
      ? true  // TODO: только если действительно использовал бонус шаг
      : player.logistUsedThisCycle,
  };

  // Обновить occupiedBy узлов
  const fromNode = state.nodes[fromNodeId]!;
  const toNode   = state.nodes[targetNodeId]!;

  const diff: StateDiff = {
    players: { [playerId]: updatedPlayer },
    nodes: {
      [fromNodeId]: {
        ...fromNode,
        occupiedBy: fromNode.occupiedBy.filter(id => id !== playerId),
        status: fromNode.occupiedBy.length <= 1 ? 'inactive' : 'occupied',
      },
      [targetNodeId]: {
        ...toNode,
        occupiedBy: [...toNode.occupiedBy, playerId],
        status: 'activated',
      },
    },
    turnPhase: 'node_action',
    eventLog: logs,
  };

  const nextState = applyDiff(state, diff);
  return { state: nextState, diff };
}

// ─────────────────────────────────────────────
//  ЗАВЕРШИТЬ ХОД
// ─────────────────────────────────────────────

export type EndTurnResult = {
  state: MatchState;
  diff:  StateDiff;
  matchOver: boolean;
};

export function endTurn(state: MatchState, playerId: string): EndTurnResult {
  const currentIdx = state.turnOrder.indexOf(playerId);
  const nextIdx    = (currentIdx + 1) % state.turnOrder.length;
  const nextPlayer = state.turnOrder[nextIdx]!;

  // Новый раунд? Когда цикл вернулся к первому игроку
  const isNewRound = nextIdx === 0;
  const newRound   = isNewRound ? state.round + 1 : state.round;

  // Проверка конца матча
  if (isNewRound && newRound > state.maxRounds) {
    return finishMatch(state);
  }

  const logs: EventLogEntry[] = [{
    id: nanoid(),
    round: state.round,
    playerId,
    type: 'end_turn',
    description: `${state.players[playerId]!.displayName} завершил ход`,
    timestamp: Date.now(),
  }];

  const diff: StateDiff = {
    activePlayerId: nextPlayer,
    turnPhase:      'move',
    round:          newRound,
    eventLog:       logs,
  };

  let nextState = applyDiff(state, diff);

  // Сбросить статусы узлов и пометить доступные для следующего игрока
  nextState = markAvailableNodes(nextState, nextPlayer);

  // Обновить nodes diff
  diff.nodes = {};
  for (const [nodeId, nodeState] of Object.entries(nextState.nodes)) {
    if (state.nodes[nodeId]?.status !== nodeState.status) {
      diff.nodes[nodeId] = nodeState;
    }
  }

  return { state: nextState, diff, matchOver: false };
}

// ─────────────────────────────────────────────
//  ЗАВЕРШЕНИЕ МАТЧА
// ─────────────────────────────────────────────

function finishMatch(state: MatchState): EndTurnResult {
  const results = buildMatchResults(state);

  const logs: EventLogEntry[] = [{
    id: nanoid(),
    round: state.round,
    playerId: 'system',
    type: 'match_finished',
    description: `Матч завершён. Победитель: ${state.players[results.winnerId]?.displayName}`,
    timestamp: Date.now(),
  }];

  const diff: StateDiff = {
    status:   'finished',
    winner:   results.winnerId,
    turnPhase:'finished',
    eventLog: logs,
  };

  const nextState = applyDiff(state, diff);
  return { state: nextState, diff, matchOver: true };
}
