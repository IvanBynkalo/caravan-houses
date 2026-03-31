import { describe, it, expect } from 'vitest';
import { getAvailableNodes, validateMove } from '../engine/match/RouteValidator.js';
import { makeMatchState, makePlayer }       from './helpers.js';

describe('RouteValidator', () => {

  describe('getAvailableNodes', () => {

    it('возвращает узлы в радиусе 1–3 шагов от start', () => {
      const state = makeMatchState();
      const available = getAvailableNodes(state, 'player_1');

      // start → node_01, node_02 (1 шаг)
      expect(available).toContain('node_01');
      expect(available).toContain('node_02');

      // start → node_01 → node_03 (2 шага)
      expect(available).toContain('node_03');

      // start → node_02 → node_04 (2 шага)
      expect(available).toContain('node_04');
    });

    it('не включает стартовый узел в список доступных', () => {
      const state = makeMatchState();
      const available = getAvailableNodes(state, 'player_1');
      expect(available).not.toContain('start');
    });

    it('не выходит за 3 шага без модификаторов', () => {
      const state = makeMatchState();
      const available = getAvailableNodes(state, 'player_1');
      // hub_01 и hub_02 — минимум 5 шагов от start, не должны быть доступны
      expect(available).not.toContain('hub_01');
      expect(available).not.toContain('hub_02');
    });

    it('Картограф (s_008) добавляет +1 шаг', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ specialists: ['s_008'] }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      const available = getAvailableNodes(state, 'player_1');
      // С Картографом можно пройти 4 шага
      // start → 01 → 03 → 05 → 07 (4 шага)
      expect(available).toContain('node_07');
    });

    it('Логист (s_001) добавляет +1 шаг если не использован', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ specialists: ['s_001'], logistUsedThisCycle: false }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      const available = getAvailableNodes(state, 'player_1');
      expect(available).toContain('node_07');
    });

    it('Логист не добавляет шаг если уже использован в цикле', () => {
      const withLogist = makeMatchState({
        players: {
          player_1: makePlayer({ specialists: ['s_001'], logistUsedThisCycle: true }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      const withoutLogist = makeMatchState();

      const with3Steps    = getAvailableNodes(withLogist, 'player_1');
      const withoutExtras = getAvailableNodes(withoutLogist, 'player_1');

      expect(with3Steps.length).toBe(withoutExtras.length);
    });

    it('не включает заблокированные узлы', () => {
      const state = makeMatchState();
      state.nodes['node_01']!.status = 'blocked';
      const available = getAvailableNodes(state, 'player_1');
      expect(available).not.toContain('node_01');
    });
  });

  describe('validateMove', () => {

    it('разрешает допустимый ход', () => {
      const state  = makeMatchState();
      const result = validateMove(state, 'player_1', 'node_01');
      expect(result.valid).toBe(true);
    });

    it('запрещает ход не в свой ход', () => {
      const state  = makeMatchState();
      const result = validateMove(state, 'player_2', 'node_01');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('NOT_YOUR_TURN');
    });

    it('запрещает недопустимый узел', () => {
      const state  = makeMatchState();
      const result = validateMove(state, 'player_1', 'hub_01');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_MOVE');
    });

    it('запрещает заблокированный узел', () => {
      const state = makeMatchState();
      state.nodes['node_01']!.status = 'blocked';
      const result = validateMove(state, 'player_1', 'node_01');
      expect(result.valid).toBe(false);
    });

    it('запрещает ход в неправильной фазе', () => {
      const state = makeMatchState({ turnPhase: 'node_action' });
      const result = validateMove(state, 'player_1', 'node_01');
      expect(result.valid).toBe(false);
    });
  });
});
