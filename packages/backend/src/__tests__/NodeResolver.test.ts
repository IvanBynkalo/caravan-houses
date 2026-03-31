import { describe, it, expect } from 'vitest';
import { resolveNodeAction }     from '../engine/match/NodeResolver.js';
import { makeMatchState, makePlayer } from './helpers.js';

// Перемещаем игрока на нужный узел для теста
function atNode(nodeId: string, extra: Partial<ReturnType<typeof makePlayer>> = {}) {
  return makeMatchState({
    players: {
      player_1: makePlayer({ currentNodeId: nodeId, ...extra }),
      player_2: makePlayer({ id: 'player_2', isAI: true, currentNodeId: 'start' }),
    },
    nodes: {
      start:    { id: 'start',   status: 'inactive', occupiedBy: ['player_2'] },
      node_01:  { id: 'node_01', status: 'activated', occupiedBy: [] },
      node_02:  { id: 'node_02', status: 'activated', occupiedBy: [] },
      node_03:  { id: 'node_03', status: 'activated', occupiedBy: [] },
      node_04:  { id: 'node_04', status: 'activated', occupiedBy: [] },
      node_05:  { id: 'node_05', status: 'activated', occupiedBy: [] },
      node_06:  { id: 'node_06', status: 'activated', occupiedBy: [] },
      node_07:  { id: 'node_07', status: 'activated', occupiedBy: [] },
      node_08:  { id: 'node_08', status: 'activated', occupiedBy: [] },
      node_09:  { id: 'node_09', status: 'activated', occupiedBy: [] },
      hub_01:   { id: 'hub_01',  status: 'activated', occupiedBy: [] },
      hub_02:   { id: 'hub_02',  status: 'activated', occupiedBy: [] },
      [nodeId]: { id: nodeId,    status: 'activated', occupiedBy: ['player_1'] },
    },
    turnPhase: 'node_action',
  });
}

describe('NodeResolver', () => {

  // ── Market ──────────────────────────────────

  describe('market — gold', () => {
    it('добавляет золото игроку', () => {
      const state = atNode('node_01');
      const { diff, error } = resolveNodeAction(state, 'player_1', { kind: 'market', choice: 'gold' });

      expect(error).toBeUndefined();
      const p = diff.players!['player_1']!;
      expect(p.resources!.gold).toBeGreaterThan(6); // базовое 6 + бонус рынка
    });

    it('торговый флаг (card_019) даёт +1 золото', () => {
      const state = atNode('node_01', { hand: ['card_019'] });
      const { diff } = resolveNodeAction(state, 'player_1', { kind: 'market', choice: 'gold' });
      const p = diff.players!['player_1']!;
      // Рынок node_01 даёт 2 + 1 флаг = 3
      expect(p.resources!.gold).toBe(9); // 6 + 3
    });
  });

  describe('market — contract', () => {
    it('добавляет контракт игроку', () => {
      const state = atNode('node_01', { activeContracts: [] });
      const { diff, error } = resolveNodeAction(state, 'player_1', { kind: 'market', choice: 'contract' });

      expect(error).toBeUndefined();
      const p = diff.players!['player_1']!;
      expect(p.activeContracts!.length).toBe(1);
    });

    it('отказывает если контрактов уже 3', () => {
      const state = atNode('node_01', { activeContracts: ['c_001', 'c_002', 'c_003'] });
      const { error } = resolveNodeAction(state, 'player_1', { kind: 'market', choice: 'contract' });
      expect(error).toBe('CONTRACT_LIMIT');
    });
  });

  describe('market — exchange', () => {
    it('обменивает груз на золото', () => {
      const state = atNode('node_05', { resources: { gold: 6, influence: 0, cargo: 3, licenses: [] } });
      const { diff, error } = resolveNodeAction(state, 'player_1', { kind: 'market', choice: 'exchange' });

      expect(error).toBeUndefined();
      const p = diff.players!['player_1']!;
      expect(p.resources!.cargo).toBe(1);   // 3 - 2
      expect(p.resources!.gold).toBeGreaterThanOrEqual(10); // 6 + 4
    });

    it('отказывает при недостатке груза', () => {
      const state = atNode('node_05', { resources: { gold: 6, influence: 0, cargo: 1, licenses: [] } });
      const { error } = resolveNodeAction(state, 'player_1', { kind: 'market', choice: 'exchange' });
      expect(error).toBe('INSUFFICIENT_RESOURCES');
    });
  });

  // ── Warehouse ────────────────────────────────

  describe('warehouse', () => {
    it('добавляет грузовую партию', () => {
      const state = atNode('node_02', { resources: { gold: 6, influence: 0, cargo: 0, licenses: [] } });
      const { diff, error } = resolveNodeAction(state, 'player_1', { kind: 'warehouse' });

      expect(error).toBeUndefined();
      const p = diff.players!['player_1']!;
      expect(p.resources!.cargo).toBe(1);
    });

    it('отказывает при полном складе (3)', () => {
      const state = atNode('node_02', { resources: { gold: 6, influence: 0, cargo: 3, licenses: [] } });
      const { error } = resolveNodeAction(state, 'player_1', { kind: 'warehouse' });
      expect(error).toBe('CARGO_LIMIT');
    });

    it('снабженец (s_003) даёт +1 партию', () => {
      const state = atNode('node_02', {
        specialists: ['s_003'],
        resources: { gold: 6, influence: 0, cargo: 0, licenses: [] },
      });
      const { diff } = resolveNodeAction(state, 'player_1', { kind: 'warehouse' });
      const p = diff.players!['player_1']!;
      expect(p.resources!.cargo).toBe(2);
    });

    it('снабженец не превышает лимит 3', () => {
      const state = atNode('node_02', {
        specialists: ['s_003'],
        resources: { gold: 6, influence: 0, cargo: 2, licenses: [] },
      });
      const { diff } = resolveNodeAction(state, 'player_1', { kind: 'warehouse' });
      const p = diff.players!['player_1']!;
      expect(p.resources!.cargo).toBe(3); // не 4
    });
  });

  // ── Archive ──────────────────────────────────

  describe('archive', () => {
    it('выдаёт лицензию за золото', () => {
      const state = atNode('node_07', { resources: { gold: 6, influence: 0, cargo: 1, licenses: [] } });
      const { diff, error } = resolveNodeAction(state, 'player_1', {
        kind: 'archive', licenseId: 'trade_1',
      });

      expect(error).toBeUndefined();
      const p = diff.players!['player_1']!;
      expect(p.resources!.licenses).toContain('trade_1');
      expect(p.resources!.gold).toBe(3); // 6 - 3
    });

    it('запрещает повторное получение той же лицензии', () => {
      const state = atNode('node_07', {
        resources: { gold: 6, influence: 0, cargo: 1, licenses: ['trade_1'] },
      });
      const { error } = resolveNodeAction(state, 'player_1', {
        kind: 'archive', licenseId: 'trade_1',
      });
      expect(error).toBe('ALREADY_HAVE_LICENSE');
    });

    it('запрещает trade_2 без trade_1', () => {
      const state = atNode('node_07', { resources: { gold: 10, influence: 0, cargo: 1, licenses: [] } });
      const { error } = resolveNodeAction(state, 'player_1', {
        kind: 'archive', licenseId: 'trade_2',
      });
      expect(error).toBe('LICENSE_MISSING_PREREQ');
    });

    it('применяет скидку архивариуса (s_005)', () => {
      const state = atNode('node_07', {
        specialists: ['s_005'],
        resources: { gold: 6, influence: 0, cargo: 1, licenses: [] },
      });
      const { diff } = resolveNodeAction(state, 'player_1', {
        kind: 'archive', licenseId: 'trade_1',
      });
      const p = diff.players!['player_1']!;
      expect(p.resources!.gold).toBe(4); // 6 - (3-1) = 4
    });

    it('отказывает при нехватке золота', () => {
      const state = atNode('node_07', { resources: { gold: 2, influence: 0, cargo: 1, licenses: [] } });
      const { error } = resolveNodeAction(state, 'player_1', {
        kind: 'archive', licenseId: 'trade_1',
      });
      expect(error).toBe('INSUFFICIENT_RESOURCES');
    });
  });

  // ── Build ────────────────────────────────────

  describe('build', () => {
    it('строит здание за золото', () => {
      const state = atNode('node_06', { resources: { gold: 6, influence: 0, cargo: 1, licenses: [] } });
      const { diff, error } = resolveNodeAction(state, 'player_1', {
        kind: 'build', buildingId: 'trading_post',
      });

      expect(error).toBeUndefined();
      const p = diff.players!['player_1']!;
      expect(p.resources!.gold).toBe(2); // 6 - 4
      expect(p.buildings).toContainEqual({ buildingId: 'trading_post', nodeId: 'node_06' });
      expect(diff.nodes!['node_06']!.buildingId).toBe('trading_post');
    });

    it('запрещает строить в занятом слоте', () => {
      const state = atNode('node_06', { resources: { gold: 6, influence: 0, cargo: 1, licenses: [] } });
      state.nodes['node_06']!.buildingId = 'warehouse';
      const { error } = resolveNodeAction(state, 'player_1', {
        kind: 'build', buildingId: 'trading_post',
      });
      expect(error).toBe('ALREADY_BUILT');
    });

    it('мастер-строитель (s_007) даёт скидку', () => {
      const state = atNode('node_06', {
        specialists: ['s_007'],
        resources: { gold: 6, influence: 0, cargo: 1, licenses: [] },
      });
      const { diff } = resolveNodeAction(state, 'player_1', {
        kind: 'build', buildingId: 'trading_post',
      });
      const p = diff.players!['player_1']!;
      expect(p.resources!.gold).toBe(3); // 6 - (4-1) = 3
    });
  });

  // ── Delivery ─────────────────────────────────

  describe('hub — delivery', () => {
    it('выполняет доставку и начисляет награду', () => {
      const state = atNode('hub_01', {
        resources: { gold: 6, influence: 0, cargo: 1, licenses: [] },
        activeContracts: ['c_001'],
      });
      const { diff, error } = resolveNodeAction(state, 'player_1', {
        kind: 'hub', subAction: 'deliver', contractId: 'c_001',
      });

      expect(error).toBeUndefined();
      const p = diff.players!['player_1']!;
      expect(p.resources!.cargo).toBe(0);          // потратил 1 партию
      expect(p.resources!.gold).toBeGreaterThan(6); // получил золото
      expect(p.score).toBeGreaterThan(0);            // получил очки
      expect(p.completedContracts).toContain('c_001');
      expect(p.activeContracts).not.toContain('c_001');
    });

    it('сбрасывает флаг логиста после доставки', () => {
      const state = atNode('hub_01', {
        specialists: ['s_001'],
        logistUsedThisCycle: true,
        resources: { gold: 6, influence: 0, cargo: 1, licenses: [] },
        activeContracts: ['c_001'],
      });
      const { diff } = resolveNodeAction(state, 'player_1', {
        kind: 'hub', subAction: 'deliver', contractId: 'c_001',
      });
      expect(diff.players!['player_1']!.logistUsedThisCycle).toBe(false);
    });

    it('отказывает без нужного груза', () => {
      const state = atNode('hub_01', {
        resources: { gold: 6, influence: 0, cargo: 0, licenses: [] },
        activeContracts: ['c_001'],
      });
      const { error } = resolveNodeAction(state, 'player_1', {
        kind: 'hub', subAction: 'deliver', contractId: 'c_001',
      });
      expect(error).toBe('INSUFFICIENT_RESOURCES');
    });

    it('отказывает без нужной лицензии', () => {
      const state = atNode('hub_01', {
        resources: { gold: 6, influence: 0, cargo: 1, licenses: [] },
        activeContracts: ['c_007'], // требует trade_1
      });
      const { error } = resolveNodeAction(state, 'player_1', {
        kind: 'hub', subAction: 'deliver', contractId: 'c_007',
      });
      expect(error).toBe('LICENSE_REQUIRED');
    });

    it('оценщик (s_002) добавляет +1 золото', () => {
      const state = atNode('hub_01', {
        specialists: ['s_002'],
        resources: { gold: 6, influence: 0, cargo: 1, licenses: [] },
        activeContracts: ['c_001'],
      });
      const withSpecialist = resolveNodeAction(state, 'player_1', {
        kind: 'hub', subAction: 'deliver', contractId: 'c_001',
      });

      const stateNoSpec = atNode('hub_01', {
        resources: { gold: 6, influence: 0, cargo: 1, licenses: [] },
        activeContracts: ['c_001'],
      });
      const withoutSpecialist = resolveNodeAction(stateNoSpec, 'player_1', {
        kind: 'hub', subAction: 'deliver', contractId: 'c_001',
      });

      const goldWith    = withSpecialist.diff.players!['player_1']!.resources!.gold!;
      const goldWithout = withoutSpecialist.diff.players!['player_1']!.resources!.gold!;
      expect(goldWith).toBe(goldWithout + 1);
    });

    it('бонус hub_01 за портовую лицензию (+2 золота)', () => {
      const stateWith = atNode('hub_01', {
        resources: { gold: 6, influence: 0, cargo: 1, licenses: ['port'] },
        activeContracts: ['c_001'],
      });
      const stateWithout = atNode('hub_01', {
        resources: { gold: 6, influence: 0, cargo: 1, licenses: [] },
        activeContracts: ['c_001'],
      });

      const { diff: dWith }    = resolveNodeAction(stateWith, 'player_1', { kind: 'hub', subAction: 'deliver', contractId: 'c_001' });
      const { diff: dWithout } = resolveNodeAction(stateWithout, 'player_1', { kind: 'hub', subAction: 'deliver', contractId: 'c_001' });

      const goldWith    = dWith.players!['player_1']!.resources!.gold!;
      const goldWithout = dWithout.players!['player_1']!.resources!.gold!;
      expect(goldWith).toBe(goldWithout + 2);
    });
  });

  // ── Risky ────────────────────────────────────

  describe('risky', () => {
    it('proceed:false не меняет ресурсы', () => {
      const state = atNode('node_04');
      const { diff } = resolveNodeAction(state, 'player_1', { kind: 'risky', proceed: false });
      // Золото не изменилось (только постройка могла добавить что-то)
      const gold = diff.players!['player_1']!.resources?.gold;
      expect(gold === undefined || gold === 6).toBe(true);
    });

    it('капитан охраны (s_004) защищает от штрафа', () => {
      // Запускаем 20 раз, золото не должно упасть ниже стартового
      const results: number[] = [];
      for (let i = 0; i < 20; i++) {
        const state = atNode('node_04', { specialists: ['s_004'] });
        const { diff } = resolveNodeAction(state, 'player_1', { kind: 'risky', proceed: true });
        results.push(diff.players!['player_1']!.resources!.gold!);
      }
      // Ни разу не должно быть меньше стартового
      expect(results.every(g => g >= 6)).toBe(true);
    });

    it('опытная охрана (card_021) защищает от штрафа', () => {
      const results: number[] = [];
      for (let i = 0; i < 20; i++) {
        const state = atNode('node_04', { hand: ['card_021'] });
        const { diff } = resolveNodeAction(state, 'player_1', { kind: 'risky', proceed: true });
        results.push(diff.players!['player_1']!.resources!.gold!);
      }
      expect(results.every(g => g >= 6)).toBe(true);
    });
  });

  // ── Skip ─────────────────────────────────────

  describe('skip', () => {
    it('не меняет ресурсы', () => {
      const state = atNode('node_01');
      const { diff, error } = resolveNodeAction(state, 'player_1', { kind: 'skip' });
      expect(error).toBeUndefined();
      // resources остаются как у makePlayer
      const p = diff.players!['player_1']!;
      expect(p.resources?.gold ?? 6).toBe(6);
    });
  });
});
