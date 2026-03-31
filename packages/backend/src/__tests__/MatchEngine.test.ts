import { describe, it, expect } from 'vitest';
import { createMatch, applyDiff, markAvailableNodes } from '../engine/match/MatchEngine.js';
import { applyMove, endTurn }                          from '../engine/match/TurnEngine.js';
import { makeMatchState, makePlayer }                  from './helpers.js';

describe('MatchEngine', () => {

  describe('createMatch', () => {

    it('создаёт матч с корректным начальным состоянием', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [
          { id: 'p1', displayName: 'Игрок 1' },
          { id: 'p2', displayName: 'Игрок 2', isAI: true },
        ],
      });

      expect(state.status).toBe('active');
      expect(state.round).toBe(1);
      expect(state.maxRounds).toBe(12);
      expect(state.turnOrder).toEqual(['p1', 'p2']);
      expect(state.activePlayerId).toBe('p1');
      expect(state.turnPhase).toBe('move');
      expect(state.mapId).toBe('map-mvp');
    });

    it('каждый игрок начинает на узле start', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [
          { id: 'p1', displayName: 'P1' },
          { id: 'p2', displayName: 'P2', isAI: true },
        ],
      });

      expect(state.players['p1']!.currentNodeId).toBe('start');
      expect(state.players['p2']!.currentNodeId).toBe('start');
    });

    it('каждый игрок получает стартовые ресурсы', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [{ id: 'p1', displayName: 'P1' }],
      });
      const p = state.players['p1']!;

      expect(p.resources.gold).toBe(6);
      expect(p.resources.cargo).toBe(1);
      expect(p.resources.influence).toBe(0);
      expect(p.resources.licenses).toEqual([]);
    });

    it('каждый игрок получает 2 карты в руку', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [{ id: 'p1', displayName: 'P1' }],
      });
      expect(state.players['p1']!.hand).toHaveLength(2);
    });

    it('каждый игрок получает 1 стартовый контракт', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [{ id: 'p1', displayName: 'P1' }],
      });
      expect(state.players['p1']!.activeContracts).toHaveLength(1);
    });

    it('два игрока получают разные стартовые контракты', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [
          { id: 'p1', displayName: 'P1' },
          { id: 'p2', displayName: 'P2', isAI: true },
        ],
      });
      const c1 = state.players['p1']!.activeContracts[0];
      const c2 = state.players['p2']!.activeContracts[0];
      expect(c1).not.toBe(c2);
    });

    it('карта содержит 12 узлов', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [{ id: 'p1', displayName: 'P1' }],
      });
      expect(Object.keys(state.nodes)).toHaveLength(12);
    });

    it('контрактный пул не пуст', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [{ id: 'p1', displayName: 'P1' }],
      });
      expect(state.contractPool.length).toBeGreaterThan(0);
    });

    it('первый игрок видит доступные узлы', () => {
      const state = createMatch({
        mapId: 'map-mvp',
        players: [{ id: 'p1', displayName: 'P1' }],
      });
      const availableCount = Object.values(state.nodes)
        .filter(n => n.status === 'available').length;
      expect(availableCount).toBeGreaterThan(0);
    });
  });

  describe('applyDiff', () => {

    it('применяет изменения ресурсов игрока', () => {
      const state = makeMatchState();
      const next  = applyDiff(state, {
        players: { player_1: { resources: { gold: 10, influence: 2, cargo: 3, licenses: [] } } },
      });
      expect(next.players['player_1']!.resources.gold).toBe(10);
    });

    it('применяет изменения узла', () => {
      const state = makeMatchState();
      const next  = applyDiff(state, {
        nodes: { node_01: { status: 'available' } },
      });
      expect(next.nodes['node_01']!.status).toBe('available');
    });

    it('добавляет записи в eventLog', () => {
      const state = makeMatchState();
      const next  = applyDiff(state, {
        eventLog: [{ id: 'e1', round: 1, playerId: 'p1', type: 'test', description: 'тест', timestamp: 1 }],
      });
      expect(next.eventLog).toHaveLength(1);
    });

    it('накапливает eventLog, не заменяет', () => {
      const state = applyDiff(makeMatchState(), {
        eventLog: [{ id: 'e1', round: 1, playerId: 'p1', type: 'test', description: 'тест1', timestamp: 1 }],
      });
      const next  = applyDiff(state, {
        eventLog: [{ id: 'e2', round: 1, playerId: 'p1', type: 'test', description: 'тест2', timestamp: 2 }],
      });
      expect(next.eventLog).toHaveLength(2);
    });

    it('не мутирует исходный state', () => {
      const state  = makeMatchState();
      const before = JSON.stringify(state);
      applyDiff(state, { round: 5 });
      expect(JSON.stringify(state)).toBe(before);
    });
  });
});

describe('TurnEngine', () => {

  describe('applyMove', () => {

    it('перемещает игрока на целевой узел', () => {
      const state          = makeMatchState();
      const { state: next } = applyMove(state, 'player_1', 'node_01');
      expect(next.players['player_1']!.currentNodeId).toBe('node_01');
    });

    it('убирает игрока из предыдущего узла', () => {
      const state          = makeMatchState();
      const { state: next } = applyMove(state, 'player_1', 'node_01');
      expect(next.nodes['start']!.occupiedBy).not.toContain('player_1');
    });

    it('добавляет игрока в новый узел', () => {
      const state          = makeMatchState();
      const { state: next } = applyMove(state, 'player_1', 'node_01');
      expect(next.nodes['node_01']!.occupiedBy).toContain('player_1');
    });

    it('переключает фазу в node_action', () => {
      const state          = makeMatchState();
      const { state: next } = applyMove(state, 'player_1', 'node_01');
      expect(next.turnPhase).toBe('node_action');
    });

    it('создаёт запись в eventLog', () => {
      const state       = makeMatchState();
      const { diff }    = applyMove(state, 'player_1', 'node_01');
      expect(diff.eventLog?.length).toBeGreaterThan(0);
    });
  });

  describe('endTurn', () => {

    it('передаёт ход следующему игроку', () => {
      const state           = makeMatchState({ turnPhase: 'end' });
      const { state: next } = endTurn(state, 'player_1');
      expect(next.activePlayerId).toBe('player_2');
    });

    it('не увеличивает раунд пока не прошли все игроки', () => {
      const state           = makeMatchState({ turnPhase: 'end' });
      const { state: next } = endTurn(state, 'player_1');
      expect(next.round).toBe(1);
    });

    it('увеличивает раунд когда все игроки сделали ход', () => {
      // Ход player_2 — последнего в turnOrder
      const state = makeMatchState({
        activePlayerId: 'player_2',
        turnPhase: 'end',
      });
      const { state: next } = endTurn(state, 'player_2');
      expect(next.round).toBe(2);
      expect(next.activePlayerId).toBe('player_1');
    });

    it('завершает матч после maxRounds раундов', () => {
      const state = makeMatchState({
        round:          12,
        maxRounds:      12,
        activePlayerId: 'player_2',
        turnPhase:      'end',
      });
      const { matchOver, state: next } = endTurn(state, 'player_2');
      expect(matchOver).toBe(true);
      expect(next.status).toBe('finished');
      expect(next.winner).toBeDefined();
    });

    it('не мутирует исходный state', () => {
      const state  = makeMatchState({ turnPhase: 'end' });
      const before = JSON.stringify(state);
      endTurn(state, 'player_1');
      expect(JSON.stringify(state)).toBe(before);
    });
  });
});
