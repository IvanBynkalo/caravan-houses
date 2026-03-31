// ─────────────────────────────────────────────
//  CONTRACTS
// ─────────────────────────────────────────────

export type ContractTier = 'small' | 'medium' | 'large';

export type ContractData = {
  id: string;
  name: string;
  tier: ContractTier;
  cargo_type: string;
  required_license: string | null;
  required_cargo: number;
  reward_gold: number;
  reward_influence: number;
  reward_score: number;
  hub_preference: 'hub_01' | 'hub_02' | 'any';
  description: string;
};

// ─────────────────────────────────────────────
//  SPECIALISTS
// ─────────────────────────────────────────────

export type SpecialistData = {
  id: string;
  name: string;
  tier: 1 | 2;
  cost_gold: number;
  effect_type: string;
  effect_value: number | string;
  description: string;
  hire_node: 'node_03' | 'node_08' | 'any';
};

// ─────────────────────────────────────────────
//  CARDS
// ─────────────────────────────────────────────

export type CardType = 'opportunity' | 'house_privilege';

export type CardData = {
  id: string;
  name: string;
  type: CardType;
  effect_type: string;
  effect_value: number | string;
  one_time: boolean;
  description: string;
};

// ─────────────────────────────────────────────
//  LICENSES
// ─────────────────────────────────────────────

export type LicenseData = {
  id: string;
  name: string;
  cost_gold: number;
  requires: string | null;
  effects: string[];
  score_bonus: number;
  description: string;
};

// ─────────────────────────────────────────────
//  BUILDINGS
// ─────────────────────────────────────────────

export type BuildingData = {
  id: string;
  name: string;
  cost_gold: number;
  effect_type: string;
  effect_trigger: 'owner_visit' | 'any_visit' | 'passive';
  effect_value: number;
  score_bonus: number;
  description: string;
};

// ─────────────────────────────────────────────
//  GAME CATALOG (собранные данные)
// ─────────────────────────────────────────────

export type GameCatalog = {
  contracts:   Record<string, ContractData>;
  specialists: Record<string, SpecialistData>;
  cards:       Record<string, CardData>;
  licenses:    Record<string, LicenseData>;
  buildings:   Record<string, BuildingData>;
};
