// ─────────────────────────────────────────────
//  NODE TYPES
// ─────────────────────────────────────────────

export type NodeType =
  | 'start'
  | 'market'
  | 'warehouse'
  | 'hire'
  | 'archive'
  | 'build_slot'
  | 'risky'
  | 'hub';

// ─────────────────────────────────────────────
//  NODE ACTION DEFINITIONS (из JSON карты)
// ─────────────────────────────────────────────

export type NodeActionDef =
  | { kind: 'market';    choice: 'gold';     label: string; reward: { gold: number } }
  | { kind: 'market';    choice: 'contract'; label: string; reward: { contract: 'small' | 'medium' } }
  | { kind: 'market';    choice: 'exchange'; label: string; cost: { cargo: number }; reward: { gold: number } }
  | { kind: 'warehouse'; label: string; reward: { cargo: number } }
  | { kind: 'hire';      label: string; pool: 'tier_1' | 'tier_2' }
  | { kind: 'archive';   licenseId: string; label: string; cost: { gold: number }; requires?: string }
  | { kind: 'build';     buildingId: string; label: string; cost: { gold: number } }
  | { kind: 'risky';     label: string; outcomes: RiskyOutcome[] }
  | { kind: 'hub';       label: string };

export type RiskyOutcome = {
  probability: number;
  effect: { gold?: number };
  label: string;
};

export type HubBonus = {
  condition: string;   // например: "has_license:port"
  effect: { gold?: number; score?: number };
  label: string;
};

// ─────────────────────────────────────────────
//  MAP NODE DATA
// ─────────────────────────────────────────────

export type MapNodeData = {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  r: number;
  connections: string[];
  actions: NodeActionDef[];
  bonuses?: HubBonus[];
  startingNode?: boolean;
};

// ─────────────────────────────────────────────
//  MAP EDGE
// ─────────────────────────────────────────────

export type MapEdge = {
  from: string;
  to: string;
};

// ─────────────────────────────────────────────
//  FULL MAP DATA
// ─────────────────────────────────────────────

export type MapData = {
  id: string;
  name: string;
  viewBox: string;
  nodes: MapNodeData[];
  edges: MapEdge[];
};
