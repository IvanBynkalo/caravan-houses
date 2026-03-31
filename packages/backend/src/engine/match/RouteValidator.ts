import type { MatchState, PlayerState } from '@caravan/shared';
import { loadMap, getReachableNodes } from '../map/MapLoader.js';
import { config } from '../../config.js';

export type MoveModifiers = {
  extraSteps: number;       // от Логиста, карт
  allowBackward: boolean;   // от card_013
};

// Считаем модификаторы движения для игрока
export function getMoveModifiers(player: PlayerState): MoveModifiers {
  let extraSteps = 0;
  let allowBackward = false;

  // Картограф (s_008) — постоянный +1
  if (player.specialists.includes('s_008')) {
    extraSteps += 1;
  }

  // Логист (s_001) — +1 если не использован в этом цикле
  if (player.specialists.includes('s_001') && !player.logistUsedThisCycle) {
    extraSteps += 1;
  }

  // TODO: card_001 / card_008 / card_013 применяются через play_card до хода

  return { extraSteps, allowBackward };
}

// Возвращает список nodeId, в которые игрок может переместиться
export function getAvailableNodes(state: MatchState, playerId: string): string[] {
  const player = state.players[playerId];
  if (!player) return [];

  const map = loadMap(state.mapId);
  const mods = getMoveModifiers(player);

  const maxSteps = config.moveMax + mods.extraSteps;

  const reachable = getReachableNodes(
    map,
    player.currentNodeId,
    maxSteps,
    mods.allowBackward,
  );

  // Фильтруем заблокированные узлы
  return reachable.filter(nodeId => {
    const nodeState = state.nodes[nodeId];
    return nodeState?.status !== 'blocked';
  });
}

// Валидация: можно ли игроку переместиться в конкретный узел
export function validateMove(
  state: MatchState,
  playerId: string,
  targetNodeId: string,
): { valid: boolean; reason?: string } {
  if (state.activePlayerId !== playerId) {
    return { valid: false, reason: 'NOT_YOUR_TURN' };
  }

  if (state.turnPhase !== 'move') {
    return { valid: false, reason: 'WRONG_PHASE' };
  }

  const available = getAvailableNodes(state, playerId);
  if (!available.includes(targetNodeId)) {
    return { valid: false, reason: 'INVALID_MOVE' };
  }

  const nodeState = state.nodes[targetNodeId];
  if (nodeState?.status === 'blocked') {
    return { valid: false, reason: 'NODE_BLOCKED' };
  }

  return { valid: true };
}
