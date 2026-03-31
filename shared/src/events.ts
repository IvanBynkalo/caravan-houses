import type { MatchState, MatchResults, PlayerState, NodeState, EventLogEntry } from './match.js';
import type { NodeAction } from './intents.js';

// ─────────────────────────────────────────────
//  REWARD
// ─────────────────────────────────────────────

export type Reward = {
  gold: number;
  influence: number;
  cargo: number;
  score: number;
};

// ─────────────────────────────────────────────
//  STATE DIFF (частичное обновление)
// ─────────────────────────────────────────────

export type StateDiff = Partial<{
  players:        Partial<Record<string, Partial<PlayerState>>>;
  nodes:          Partial<Record<string, Partial<NodeState>>>;
  contractPool:   string[];
  usedContracts:  string[];
  round:          number;
  activePlayerId: string;
  turnPhase:      import('./match.js').TurnPhase;
  status:         import('./match.js').MatchStatus;
  winner:         string;
  eventLog:       EventLogEntry[];   // только новые записи
}>;

// ─────────────────────────────────────────────
//  SERVER EVENTS (server → client)
// ─────────────────────────────────────────────

export type ServerEvent =
  | { type: 'match_started';       state: MatchState }
  | { type: 'state_diff';          diff: StateDiff }
  | { type: 'turn_started';        playerId: string; round: number }
  | { type: 'move_applied';        playerId: string; fromNodeId: string; toNodeId: string }
  | { type: 'node_activated';      nodeId: string; availableActions: NodeAction[] }
  | { type: 'delivery_completed';  playerId: string; contractId: string; reward: Reward }
  | { type: 'match_finished';      results: MatchResults }
  | { type: 'error';               code: string; message: string }
  | { type: 'reconnect_ok';        state: MatchState }
  | { type: 'ai_thinking' }
  | { type: 'ai_done' };

// ─────────────────────────────────────────────
//  ERROR CODES
// ─────────────────────────────────────────────

export const ErrorCode = {
  NOT_YOUR_TURN:          'NOT_YOUR_TURN',
  INVALID_MOVE:           'INVALID_MOVE',
  INSUFFICIENT_RESOURCES: 'INSUFFICIENT_RESOURCES',
  CONTRACT_NOT_ACTIVE:    'CONTRACT_NOT_ACTIVE',
  MATCH_NOT_FOUND:        'MATCH_NOT_FOUND',
  INVALID_INTENT:         'INVALID_INTENT',
  NODE_BLOCKED:           'NODE_BLOCKED',
  SLOT_OCCUPIED:          'SLOT_OCCUPIED',
  LICENSE_REQUIRED:       'LICENSE_REQUIRED',
  LICENSE_MISSING_PREREQ: 'LICENSE_MISSING_PREREQ',
  CARGO_LIMIT:            'CARGO_LIMIT',
  ALREADY_BUILT:          'ALREADY_BUILT',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];
