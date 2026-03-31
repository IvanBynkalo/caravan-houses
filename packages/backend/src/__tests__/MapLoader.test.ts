import { describe, it, expect } from 'vitest';
import { loadMap, getReachableNodes, getStartNode, getNodeById } from '../engine/map/MapLoader.js';

describe('MapLoader', () => {

  describe('loadMap', () => {
    it('загружает map-mvp', () => {
      const map = loadMap('map-mvp');
      expect(map.id).toBe('map-mvp');
      expect(map.nodes).toHaveLength(12);
      expect(map.edges).toHaveLength(14);
    });

    it('бросает ошибку для неизвестной карты', () => {
      expect(() => loadMap('unknown-map')).toThrow();
    });

    it('кэширует карту (возвращает тот же объект)', () => {
      const a = loadMap('map-mvp');
      const b = loadMap('map-mvp');
      expect(a).toBe(b);
    });
  });

  describe('getStartNode', () => {
    it('возвращает узел типа start', () => {
      const map  = loadMap('map-mvp');
      const node = getStartNode(map);
      expect(node.type).toBe('start');
      expect(node.id).toBe('start');
    });
  });

  describe('getNodeById', () => {
    it('возвращает узел по id', () => {
      const map  = loadMap('map-mvp');
      const node = getNodeById(map, 'hub_01');
      expect(node.type).toBe('hub');
      expect(node.label).toContain('Порт');
    });

    it('бросает ошибку если узел не найден', () => {
      const map = loadMap('map-mvp');
      expect(() => getNodeById(map, 'nonexistent')).toThrow();
    });
  });

  describe('getReachableNodes — BFS', () => {
    const map = loadMap('map-mvp');

    it('1 шаг от start → node_01, node_02', () => {
      const result = getReachableNodes(map, 'start', 1);
      expect(result).toContain('node_01');
      expect(result).toContain('node_02');
      expect(result).not.toContain('node_03');
      expect(result).not.toContain('start');
    });

    it('2 шага от start включают node_03 и node_04', () => {
      const result = getReachableNodes(map, 'start', 2);
      expect(result).toContain('node_01');
      expect(result).toContain('node_02');
      expect(result).toContain('node_03');
      expect(result).toContain('node_04');
    });

    it('3 шага от start включают node_05 и node_06', () => {
      const result = getReachableNodes(map, 'start', 3);
      expect(result).toContain('node_05');
      expect(result).toContain('node_06');
    });

    it('5 шагов от start достигают hub_01 и hub_02', () => {
      const result = getReachableNodes(map, 'start', 5);
      expect(result).toContain('hub_01');
      expect(result).toContain('hub_02');
    });

    it('хабы недостижимы за 3 шага', () => {
      const result = getReachableNodes(map, 'start', 3);
      expect(result).not.toContain('hub_01');
      expect(result).not.toContain('hub_02');
    });

    it('от hub_01 нельзя двигаться дальше (нет connections)', () => {
      const result = getReachableNodes(map, 'hub_01', 3);
      expect(result).toHaveLength(0);
    });

    it('не включает стартовый узел в результат', () => {
      const result = getReachableNodes(map, 'start', 3);
      expect(result).not.toContain('start');
    });

    it('нет дублей в результате', () => {
      const result = getReachableNodes(map, 'start', 5);
      const unique = [...new Set(result)];
      expect(result.length).toBe(unique.length);
    });
  });
});
