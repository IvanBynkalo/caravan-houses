import { describe, it, expect } from 'vitest';
import { calculateFinalScore, buildMatchResults } from '../engine/match/ScoringEngine.js';
import { makeMatchState, makePlayer }              from './helpers.js';

describe('ScoringEngine', () => {

  describe('calculateFinalScore', () => {

    it('считает базовые очки (накопленные за доставки)', () => {
      const state = makeMatchState({
        players: { player_1: makePlayer({ score: 10 }), player_2: makePlayer({ id: 'player_2', isAI: true }) },
      });
      expect(calculateFinalScore(state, 'player_1')).toBe(10);
    });

    it('добавляет бонус за лицензию trade_1 (+1)', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 10, resources: { gold: 6, influence: 0, cargo: 1, licenses: ['trade_1'] } }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      expect(calculateFinalScore(state, 'player_1')).toBe(11);
    });

    it('добавляет бонус за лицензию trade_2 (+3)', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 10, resources: { gold: 6, influence: 0, cargo: 1, licenses: ['trade_2'] } }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      expect(calculateFinalScore(state, 'player_1')).toBe(13);
    });

    it('добавляет бонус за постройку trading_post (+1)', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 10, buildings: [{ buildingId: 'trading_post', nodeId: 'node_06' }] }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      expect(calculateFinalScore(state, 'player_1')).toBe(11);
    });

    it('добавляет бонус за постройку license_office (+2)', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 10, buildings: [{ buildingId: 'license_office', nodeId: 'node_06' }] }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      expect(calculateFinalScore(state, 'player_1')).toBe(12);
    });

    it('считает влияние: каждые 3 → +1 очко', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 0, resources: { gold: 6, influence: 9, cargo: 1, licenses: [] } }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      expect(calculateFinalScore(state, 'player_1')).toBe(3); // 9/3 = 3
    });

    it('влияние 2 не даёт очков', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 0, resources: { gold: 6, influence: 2, cargo: 1, licenses: [] } }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      expect(calculateFinalScore(state, 'player_1')).toBe(0);
    });

    it('родовая печать (card_025) даёт +2 в финале', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 10, hand: ['card_025'] }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      expect(calculateFinalScore(state, 'player_1')).toBe(12);
    });

    it('суммирует все бонусы вместе', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({
            score:    10,
            resources: { gold: 6, influence: 6, cargo: 1, licenses: ['trade_1', 'port'] },
            buildings: [{ buildingId: 'trading_post', nodeId: 'node_06' }],
          }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      // 10 (score) + 1 (trade_1) + 2 (port) + 1 (trading_post) + 2 (6 influence) = 16
      expect(calculateFinalScore(state, 'player_1')).toBe(16);
    });
  });

  describe('buildMatchResults', () => {

    it('возвращает победителя с наибольшим счётом', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 20 }),
          player_2: makePlayer({ id: 'player_2', score: 10, isAI: true }),
        },
      });
      const results = buildMatchResults(state);
      expect(results.winnerId).toBe('player_1');
      expect(results.players[0]!.id).toBe('player_1');
    });

    it('tie-break по золоту', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 10, resources: { gold: 5, influence: 0, cargo: 1, licenses: [] } }),
          player_2: makePlayer({ id: 'player_2', score: 10, isAI: true, resources: { gold: 8, influence: 0, cargo: 1, licenses: [] } }),
        },
      });
      const results = buildMatchResults(state);
      expect(results.winnerId).toBe('player_2');
    });

    it('tie-break по контрактам если золото равно', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 10, resources: { gold: 8, influence: 0, cargo: 1, licenses: [] }, completedContracts: ['c_001'] }),
          player_2: makePlayer({ id: 'player_2', score: 10, isAI: true, resources: { gold: 8, influence: 0, cargo: 1, licenses: [] }, completedContracts: ['c_001', 'c_002'] }),
        },
      });
      const results = buildMatchResults(state);
      expect(results.winnerId).toBe('player_2');
    });

    it('содержит правильные данные в результатах', () => {
      const state = makeMatchState({
        players: {
          player_1: makePlayer({ score: 15, deliveriesCompleted: 3, resources: { gold: 8, influence: 0, cargo: 1, licenses: ['trade_1'] }, completedContracts: ['c_001','c_002','c_003'] }),
          player_2: makePlayer({ id: 'player_2', isAI: true }),
        },
      });
      const results = buildMatchResults(state);
      const p1 = results.players.find(p => p.id === 'player_1')!;

      expect(p1.deliveries).toBe(3);
      expect(p1.gold).toBe(8);
      expect(p1.licenses).toBe(1);
      expect(p1.contracts).toBe(3);
      expect(p1.score).toBeGreaterThanOrEqual(15); // + бонус за лицензию
    });
  });
});
