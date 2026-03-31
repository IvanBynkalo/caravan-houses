import type { MatchState, PlayerState, NodeState } from '@caravan/shared';

// ─────────────────────────────────────────────
//  PLAYER FACTORY
// ─────────────────────────────────────────────

export function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id:                  'player_1',
    displayName:         'Тест',
    isAI:                false,
    currentNodeId:       'start',
    resources: {
      gold:      6,
      influence: 0,
      cargo:     1,
      licenses:  [],
    },
    hand:                [],
    activeContracts:     ['c_001'],
    completedContracts:  [],
    specialists:         [],
    buildings:           [],
    score:               0,
    deliveriesCompleted: 0,
    logistUsedThisCycle: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
//  NODE FACTORY
// ─────────────────────────────────────────────

export function makeNodes(nodeIds: string[]): Record<string, NodeState> {
  const nodes: Record<string, NodeState> = {};
  for (const id of nodeIds) {
    nodes[id] = { id, status: 'inactive', occupiedBy: [] };
  }
  return nodes;
}

// ─────────────────────────────────────────────
//  MATCH STATE FACTORY
// ─────────────────────────────────────────────

const MVP_NODE_IDS = [
  'start', 'node_01', 'node_02', 'node_03', 'node_04',
  'node_05', 'node_06', 'node_07', 'node_08', 'node_09',
  'hub_01', 'hub_02',
];

export function makeMatchState(overrides: Partial<MatchState> = {}): MatchState {
  const p1 = makePlayer({ id: 'player_1', currentNodeId: 'start' });
  const p2 = makePlayer({ id: 'player_2', displayName: 'Соперник', currentNodeId: 'start', isAI: true });

  const nodes = makeNodes(MVP_NODE_IDS);
  nodes['start']!.occupiedBy = ['player_1', 'player_2'];
  nodes['start']!.status     = 'occupied';

  return {
    id:             'match_test',
    status:         'active',
    round:          1,
    maxRounds:      12,
    turnOrder:      ['player_1', 'player_2'],
    activePlayerId: 'player_1',
    turnPhase:      'move',
    players: {
      player_1: p1,
      player_2: p2,
    },
    nodes,
    contractPool:   ['c_001','c_002','c_003','c_004','c_005','c_006','c_007'],
    usedContracts:  [],
    eventLog:       [],
    mapId:          'map-mvp',
    ...overrides,
  };
}
