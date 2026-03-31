// ─────────────────────────────────────────────
//  RESOURCES
// ─────────────────────────────────────────────

export type ResourceMap = {
  gold: number;
  influence: number;
  cargo: number;           // грузовые партии
  licenses: string[];      // id лицензий
};

// ─────────────────────────────────────────────
//  PLAYER
// ─────────────────────────────────────────────

export type BuildingPlacement = {
  buildingId: string;
  nodeId: string;
};

export type PlayerState = {
  id: string;
  displayName: string;
  isAI: boolean;
  currentNodeId: string;
  resources: ResourceMap;
  hand: string[];              // id карт в руке
  activeContracts: string[];   // id взятых контрактов
  completedContracts: string[];
  specialists: string[];       // id нанятых специалистов
  buildings: BuildingPlacement[];
  score: number;
  deliveriesCompleted: number;
  // Флаг: использовал ли логист в этом цикле
  logistUsedThisCycle: boolean;
};

// ─────────────────────────────────────────────
//  MAP / NODES
// ─────────────────────────────────────────────

export type NodeStatus =
  | 'inactive'
  | 'available'
  | 'selected'
  | 'occupied'
  | 'activated'
  | 'blocked';

export type NodeState = {
  id: string;
  status: NodeStatus;
  occupiedBy: string[];    // player ids (может быть несколько)
  buildingId?: string;
  buildingOwnerId?: string;
};

// ─────────────────────────────────────────────
//  EVENT LOG
// ─────────────────────────────────────────────

export type EventLogEntry = {
  id: string;
  round: number;
  playerId: string;
  type: string;
  description: string;
  timestamp: number;
};

// ─────────────────────────────────────────────
//  MATCH STATE
// ─────────────────────────────────────────────

export type MatchStatus = 'waiting' | 'active' | 'finished';

export type MatchState = {
  id: string;
  status: MatchStatus;
  round: number;
  maxRounds: number;
  turnOrder: string[];           // player ids в порядке ходов
  activePlayerId: string;
  turnPhase: TurnPhase;
  players: Record<string, PlayerState>;
  nodes: Record<string, NodeState>;
  contractPool: string[];        // доступные контракты (ids)
  usedContracts: string[];
  eventLog: EventLogEntry[];
  winner?: string;
  mapId: string;
};

export type TurnPhase =
  | 'move'          // ожидаем выбор узла
  | 'node_action'   // узел активирован, ожидаем действие
  | 'end'           // действие выполнено, ожидаем end_turn
  | 'finished';     // матч завершён

// ─────────────────────────────────────────────
//  MATCH RESULTS
// ─────────────────────────────────────────────

export type PlayerResult = {
  id: string;
  displayName: string;
  score: number;
  deliveries: number;
  gold: number;
  contracts: number;
  licenses: number;
};

export type MatchResults = {
  players: PlayerResult[];
  winnerId: string;
};
