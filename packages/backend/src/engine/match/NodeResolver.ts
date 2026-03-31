import type {
  MatchState, PlayerState, NodeAction, StateDiff, EventLogEntry,
} from '@caravan/shared';
import { getNodeById, loadMap } from '../map/MapLoader.js';
import {
  getGameCatalog, getSpecialistsForPool, getContractsByTier,
  getBuilding, getLicense,
} from '../cards/CatalogLoader.js';
import { config } from '../../config.js';
import { nanoid } from '../../utils/nanoid.js';

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function clonePlayer(state: MatchState, playerId: string): PlayerState {
  return JSON.parse(JSON.stringify(state.players[playerId])) as PlayerState;
}

function logEntry(state: MatchState, playerId: string, type: string, description: string): EventLogEntry {
  return {
    id: nanoid(),
    round: state.round,
    playerId,
    type,
    description,
    timestamp: Date.now(),
  };
}

// Применить эффект постройки при посещении узла
function applyBuildingEffect(
  state: MatchState,
  player: PlayerState,
  nodeId: string,
  logs: EventLogEntry[],
): PlayerState {
  const nodeState = state.nodes[nodeId];
  if (!nodeState?.buildingId || !nodeState.buildingOwnerId) return player;

  const building = getBuilding(nodeState.buildingId);
  const isOwner = nodeState.buildingOwnerId === player.id;

  if (building.effect_trigger === 'owner_visit' && isOwner) {
    player.resources.gold += building.effect_value;
    logs.push(logEntry(state, player.id, 'building_bonus',
      `${building.name}: +${building.effect_value}💰`));
  }

  if (building.effect_trigger === 'any_visit') {
    player.resources.cargo = Math.min(
      player.resources.cargo + building.effect_value,
      config.maxCargoHold,
    );
    logs.push(logEntry(state, player.id, 'building_bonus',
      `${building.name}: +${building.effect_value}📦`));
  }

  return player;
}

// Проверяем наличие привилегии house_privilege у игрока
function hasPrivilege(player: PlayerState, effectType: string): boolean {
  const catalog = getGameCatalog();
  return player.hand.some(cardId => {
    const card = catalog.cards[cardId];
    return card?.type === 'house_privilege' && card.effect_type === effectType;
  });
}

// Золото с рынка (с учётом привилегий)
function marketGoldBonus(player: PlayerState): number {
  return hasPrivilege(player, 'market_gold_bonus') ? 1 : 0;
}

// Скидка на лицензии
function licenseDiscount(player: PlayerState): number {
  let discount = 0;
  if (player.specialists.includes('s_005')) discount += 1; // Архивариус
  if (hasPrivilege(player, 'license_discount')) discount += 1;
  // Офис лицензий (постройка) — проверяется отдельно через buildingId
  return discount;
}

// Скидка на постройки
function buildDiscount(player: PlayerState): number {
  let discount = 0;
  if (player.specialists.includes('s_007')) discount += 1; // Мастер-строитель
  return discount;
}

// ─────────────────────────────────────────────
//  RESOLVE NODE ACTION
// ─────────────────────────────────────────────

export type ResolveResult = {
  diff: StateDiff;
  logs: EventLogEntry[];
  error?: string;
};

export function resolveNodeAction(
  state: MatchState,
  playerId: string,
  action: NodeAction,
): ResolveResult {
  const logs: EventLogEntry[] = [];
  let player = clonePlayer(state, playerId);
  const nodeId = player.currentNodeId;
  const map = loadMap(state.mapId);
  const nodeData = getNodeById(map, nodeId);

  // Применить эффект постройки при прибытии
  player = applyBuildingEffect(state, player, nodeId, logs);

  const diff: StateDiff = {};

  switch (action.kind) {

    // ── MARKET ───────────────────────────────
    case 'market': {
      const bonus = marketGoldBonus(player);

      if (action.choice === 'gold') {
        // Найти reward из данных карты
        const actionDef = nodeData.actions.find(
          a => a.kind === 'market' && a.choice === 'gold',
        );
        const gold = (actionDef as any)?.reward?.gold ?? 2;
        player.resources.gold += gold + bonus;
        logs.push(logEntry(state, playerId, 'market_gold',
          `Рынок: +${gold + bonus}💰`));

      } else if (action.choice === 'contract') {
        if (player.activeContracts.length >= config.maxContracts) {
          return { diff, logs, error: 'CONTRACT_LIMIT' };
        }
        const actionDef = nodeData.actions.find(
          a => a.kind === 'market' && a.choice === 'contract',
        );
        const tier: 'small' | 'medium' = (actionDef as any)?.reward?.contract ?? 'small';
        const available = getContractsByTier(tier)
          .filter(id => !state.usedContracts.includes(id) && !state.contractPool.includes(id) /* ещё не взят */);

        // Брокер (s_006) или ганзейский устав (card_020) — выбор из 2
        const choiceCount = player.specialists.includes('s_006') ? 2 :
          hasPrivilege(player, 'contract_choice_plus1') ? 2 : 1;
        const options = available.slice(0, choiceCount);

        if (options.length === 0) {
          return { diff, logs, error: 'CONTRACT_POOL_EMPTY' };
        }

        const contractId = options[0]!;
        player.activeContracts.push(contractId);
        const newPool = state.contractPool.filter(id => id !== contractId);
        diff.contractPool = newPool;
        logs.push(logEntry(state, playerId, 'take_contract',
          `Взят контракт: ${contractId}`));

      } else if (action.choice === 'exchange') {
        const actionDef = nodeData.actions.find(
          a => a.kind === 'market' && a.choice === 'exchange',
        );
        const costCargo = (actionDef as any)?.cost?.cargo ?? 2;
        const rewardGold = (actionDef as any)?.reward?.gold ?? 4;
        if (player.resources.cargo < costCargo) {
          return { diff, logs, error: 'INSUFFICIENT_RESOURCES' };
        }
        player.resources.cargo -= costCargo;
        player.resources.gold += rewardGold + bonus;
        logs.push(logEntry(state, playerId, 'market_exchange',
          `Обмен: ${costCargo}📦 → ${rewardGold + bonus}💰`));
      }
      break;
    }

    // ── WAREHOUSE ────────────────────────────
    case 'warehouse': {
      if (player.resources.cargo >= config.maxCargoHold) {
        return { diff, logs, error: 'CARGO_LIMIT' };
      }
      let amount = 1;
      if (player.specialists.includes('s_003')) amount += 1; // Снабженец
      amount = Math.min(amount, config.maxCargoHold - player.resources.cargo);
      player.resources.cargo += amount;
      logs.push(logEntry(state, playerId, 'warehouse',
        `Склад: +${amount}📦`));
      break;
    }

    // ── HIRE ─────────────────────────────────
    case 'hire': {
      const actionDef = nodeData.actions.find(a => a.kind === 'hire');
      const pool = (actionDef as any)?.pool ?? 'tier_1';
      const candidates = getSpecialistsForPool(pool)
        .filter(id => !player.specialists.includes(id));

      if (candidates.length === 0) {
        return { diff, logs, error: 'NO_SPECIALISTS_AVAILABLE' };
      }

      const catalog = getGameCatalog();
      const specialist = catalog.specialists[action.specialistId];
      if (!specialist) {
        return { diff, logs, error: 'INVALID_INTENT' };
      }
      if (!candidates.includes(action.specialistId)) {
        return { diff, logs, error: 'INVALID_INTENT' };
      }

      let cost = specialist.cost_gold;
      // Скидка от карты «Переговоры» (card_005) — применяется через play_card
      if (player.resources.gold < cost) {
        return { diff, logs, error: 'INSUFFICIENT_RESOURCES' };
      }

      player.resources.gold -= cost;
      player.specialists.push(action.specialistId);
      logs.push(logEntry(state, playerId, 'hire',
        `Нанят: ${specialist.name} за ${cost}💰`));
      break;
    }

    // ── ARCHIVE ──────────────────────────────
    case 'archive': {
      const licenseId = action.licenseId;
      const license = getLicense(licenseId);

      if (player.resources.licenses.includes(licenseId)) {
        return { diff, logs, error: 'ALREADY_HAVE_LICENSE' };
      }
      if (license.requires && !player.resources.licenses.includes(license.requires)) {
        return { diff, logs, error: 'LICENSE_MISSING_PREREQ' };
      }

      // Офис лицензий на текущем узле?
      const nodeState = state.nodes[nodeId];
      let officeDiscount = 0;
      if (nodeState?.buildingId === 'license_office') officeDiscount = 1;

      const discount = licenseDiscount(player) + officeDiscount;
      const cost = Math.max(0, license.cost_gold - discount);

      if (player.resources.gold < cost) {
        return { diff, logs, error: 'INSUFFICIENT_RESOURCES' };
      }

      player.resources.gold -= cost;
      player.resources.licenses.push(licenseId);
      logs.push(logEntry(state, playerId, 'license',
        `Получена лицензия: ${license.name} за ${cost}💰`));
      break;
    }

    // ── BUILD ────────────────────────────────
    case 'build': {
      const nodeState = state.nodes[nodeId];
      if (nodeState?.buildingId) {
        return { diff, logs, error: 'ALREADY_BUILT' };
      }

      const building = getBuilding(action.buildingId);
      const discount = buildDiscount(player);
      const cost = Math.max(0, building.cost_gold - discount);

      if (player.resources.gold < cost) {
        return { diff, logs, error: 'INSUFFICIENT_RESOURCES' };
      }

      player.resources.gold -= cost;
      player.buildings.push({ buildingId: action.buildingId, nodeId });

      diff.nodes = {
        ...diff.nodes,
        [nodeId]: {
          buildingId: action.buildingId,
          buildingOwnerId: playerId,
        },
      };

      logs.push(logEntry(state, playerId, 'build',
        `Построено: ${building.name} за ${cost}💰`));
      break;
    }

    // ── RISKY ────────────────────────────────
    case 'risky': {
      if (!action.proceed) {
        logs.push(logEntry(state, playerId, 'risky_skip', 'Отступили с перевала'));
        break;
      }

      // Опытная охрана (card_021) — никогда не штрафует
      const alwaysSafe = hasPrivilege(player, 'risky_always_safe');
      // Капитан охраны (s_004) — первый штраф за партию
      const captainProtects = player.specialists.includes('s_004');

      const actionDef = nodeData.actions.find(a => a.kind === 'risky');
      const outcomes = (actionDef as any)?.outcomes ?? [];

      const roll = Math.random();
      let cumulative = 0;
      let chosen: any = outcomes[outcomes.length - 1];
      for (const outcome of outcomes) {
        cumulative += outcome.probability;
        if (roll <= cumulative) { chosen = outcome; break; }
      }

      const goldEffect: number = chosen.effect?.gold ?? 0;

      if (goldEffect < 0 && (alwaysSafe || captainProtects)) {
        logs.push(logEntry(state, playerId, 'risky_protected',
          `Перевал: защита сработала (${chosen.label})`));
      } else {
        player.resources.gold = Math.max(0, player.resources.gold + goldEffect);
        logs.push(logEntry(state, playerId, 'risky',
          `Перевал: ${chosen.label}`));
      }
      break;
    }

    // ── HUB ──────────────────────────────────
    case 'hub': {
      if (action.subAction === 'deliver') {
        return resolveDelivery(state, player, action.contractId, nodeId, logs, diff);
      }
      if (action.subAction === 'take_contract') {
        if (player.activeContracts.length >= config.maxContracts) {
          return { diff, logs, error: 'CONTRACT_LIMIT' };
        }
        const available = state.contractPool
          .filter(id => !player.activeContracts.includes(id));
        if (!available.includes(action.contractId)) {
          return { diff, logs, error: 'INVALID_INTENT' };
        }
        player.activeContracts.push(action.contractId);
        diff.contractPool = state.contractPool.filter(id => id !== action.contractId);
        logs.push(logEntry(state, playerId, 'take_contract',
          `Взят контракт: ${action.contractId}`));
      }
      break;
    }

    // ── SKIP ─────────────────────────────────
    case 'skip': {
      logs.push(logEntry(state, playerId, 'skip', 'Действие пропущено'));
      break;
    }

    default: {
      return { diff, logs, error: 'INVALID_INTENT' };
    }
  }

  diff.players = { [playerId]: player };
  diff.eventLog = logs;
  return { diff, logs };
}

// ─────────────────────────────────────────────
//  DELIVERY
// ─────────────────────────────────────────────

function resolveDelivery(
  state: MatchState,
  player: PlayerState,
  contractId: string,
  hubNodeId: string,
  logs: EventLogEntry[],
  diff: StateDiff,
): ResolveResult {
  const catalog = getGameCatalog();
  const contract = catalog.contracts[contractId];

  if (!contract) return { diff, logs, error: 'CONTRACT_NOT_ACTIVE' };
  if (!player.activeContracts.includes(contractId)) {
    return { diff, logs, error: 'CONTRACT_NOT_ACTIVE' };
  }
  if (player.resources.cargo < contract.required_cargo) {
    return { diff, logs, error: 'INSUFFICIENT_RESOURCES' };
  }
  if (contract.required_license && !player.resources.licenses.includes(contract.required_license)) {
    return { diff, logs, error: 'LICENSE_REQUIRED' };
  }

  // Применить доставку
  player.resources.cargo -= contract.required_cargo;

  let gold      = contract.reward_gold;
  let influence = contract.reward_influence;
  let score     = contract.reward_score;

  // Оценщик (s_002)
  if (player.specialists.includes('s_002')) gold += 1;

  // Сеть доверия (card_024)
  if (hasPrivilege(player, 'delivery_influence')) influence += 1;

  // Бонус хаба
  const map = loadMap(state.mapId);
  const hubNode = getNodeById(map, hubNodeId);
  for (const bonus of hubNode.bonuses ?? []) {
    const [type, licId] = bonus.condition.split(':');
    if (type === 'has_license' && licId && player.resources.licenses.includes(licId)) {
      gold  += bonus.effect.gold  ?? 0;
      score += bonus.effect.score ?? 0;
    }
  }

  // Торговая лицензия I — +1 к medium контрактам
  if (contract.tier === 'medium' && player.resources.licenses.includes('trade_1')) {
    score += 1;
  }

  player.resources.gold      += gold;
  player.resources.influence += influence;
  player.score               += score;
  player.deliveriesCompleted += 1;
  player.logistUsedThisCycle  = false; // сброс логиста

  player.activeContracts    = player.activeContracts.filter(id => id !== contractId);
  player.completedContracts = [...player.completedContracts, contractId];

  const newUsed = [...state.usedContracts, contractId];

  logs.push(logEntry(state, player.id, 'delivery',
    `Доставлено: ${contract.name} → +${gold}💰 +${influence}🌟 +${score}⭐`));

  diff.players    = { [player.id]: player };
  diff.usedContracts = newUsed;
  diff.eventLog   = logs;

  return { diff, logs };
}
