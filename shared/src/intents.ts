// ─────────────────────────────────────────────
//  NODE ACTIONS
// ─────────────────────────────────────────────

export type MarketChoice = 'gold' | 'contract' | 'exchange';

export type NodeAction =
  | { kind: 'market';    choice: MarketChoice }
  | { kind: 'warehouse' }
  | { kind: 'hire';      specialistId: string }
  | { kind: 'archive';   licenseId: string }
  | { kind: 'build';     buildingId: string }
  | { kind: 'risky';     proceed: boolean }
  | { kind: 'hub';       subAction: 'deliver'; contractId: string }
  | { kind: 'hub';       subAction: 'take_contract'; contractId: string }
  | { kind: 'skip' };

// ─────────────────────────────────────────────
//  INTENT COMMANDS (client → server)
// ─────────────────────────────────────────────

export type Intent =
  | { type: 'start_match' }
  | { type: 'move_to_node';        nodeId: string }
  | { type: 'resolve_node_action'; action: NodeAction }
  | { type: 'play_card';           cardId: string }
  | { type: 'end_turn' }
  | { type: 'reconnect_to_match';  matchId: string };

// ─────────────────────────────────────────────
//  WEBSOCKET MESSAGE WRAPPER
// ─────────────────────────────────────────────

export type ClientMessage = {
  matchId: string;
  playerId: string;
  intent: Intent;
};
