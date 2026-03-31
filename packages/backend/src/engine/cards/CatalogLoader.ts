import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { GameCatalog, ContractData, SpecialistData, CardData, LicenseData, BuildingData } from '@caravan/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let _catalog: GameCatalog | null = null;

export function getGameCatalog(): GameCatalog {
  if (_catalog) return _catalog;

  const raw  = readFileSync(join(__dirname, '../data/gamedata.json'), 'utf-8');
  const data = JSON.parse(raw) as {
    contracts:   ContractData[];
    specialists: SpecialistData[];
    cards:       CardData[];
    licenses:    LicenseData[];
    buildings:   BuildingData[];
  };

  _catalog = {
    contracts:   Object.fromEntries(data.contracts.map((c: ContractData)     => [c.id, c])),
    specialists: Object.fromEntries(data.specialists.map((s: SpecialistData) => [s.id, s])),
    cards:       Object.fromEntries(data.cards.map((c: CardData)             => [c.id, c])),
    licenses:    Object.fromEntries(data.licenses.map((l: LicenseData)       => [l.id, l])),
    buildings:   Object.fromEntries(data.buildings.map((b: BuildingData)     => [b.id, b])),
  };

  return _catalog;
}

export function getContract(id: string): ContractData {
  const c = getGameCatalog().contracts[id];
  if (!c) throw new Error(`Contract not found: ${id}`);
  return c;
}

export function getSpecialist(id: string): SpecialistData {
  const s = getGameCatalog().specialists[id];
  if (!s) throw new Error(`Specialist not found: ${id}`);
  return s;
}

export function getCard(id: string): CardData {
  const c = getGameCatalog().cards[id];
  if (!c) throw new Error(`Card not found: ${id}`);
  return c;
}

export function getLicense(id: string): LicenseData {
  const l = getGameCatalog().licenses[id];
  if (!l) throw new Error(`License not found: ${id}`);
  return l;
}

export function getBuilding(id: string): BuildingData {
  const b = getGameCatalog().buildings[id];
  if (!b) throw new Error(`Building not found: ${id}`);
  return b;
}

export function drawCards(count: number, exclude: string[] = []): string[] {
  const catalog  = getGameCatalog();
  const allCards = Object.keys(catalog.cards).filter((id: string) => !exclude.includes(id));
  const shuffled = allCards.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getSpecialistsForPool(pool: 'tier_1' | 'tier_2', count = 2): string[] {
  const catalog = getGameCatalog();
  const tier    = pool === 'tier_1' ? 1 : 2;
  const available = Object.values(catalog.specialists)
    .filter((s: SpecialistData) => s.tier === tier)
    .map((s: SpecialistData) => s.id)
    .sort(() => Math.random() - 0.5);
  return available.slice(0, count);
}

export function getContractsByTier(tier: 'small' | 'medium' | 'large'): string[] {
  const catalog = getGameCatalog();
  return Object.values(catalog.contracts)
    .filter((c: ContractData) => c.tier === tier)
    .map((c: ContractData) => c.id);
}
