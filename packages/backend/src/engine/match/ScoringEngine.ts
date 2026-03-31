import type { MatchState, PlayerState, MatchResults, PlayerResult } from '@caravan/shared';
import { getGameCatalog } from '../cards/CatalogLoader.js';

// ─────────────────────────────────────────────
//  ФИНАЛЬНЫЙ ПОДСЧЁТ ОЧКОВ
// ─────────────────────────────────────────────

export function calculateFinalScore(state: MatchState, playerId: string): number {
  const player = state.players[playerId];
  if (!player) return 0;

  const catalog = getGameCatalog();
  let score = player.score; // уже начисленные очки за доставки

  // Лицензии
  for (const licId of player.resources.licenses) {
    const license = catalog.licenses[licId];
    if (license) score += license.score_bonus;
  }

  // Постройки
  for (const placement of player.buildings) {
    const building = catalog.buildings[placement.buildingId];
    if (building) score += building.score_bonus;
  }

  // Влияние: каждые 3 → +1 очко
  score += Math.floor(player.resources.influence / 3);

  // Родовая печать (card_025)
  const hasHeirloomSeal = player.hand.some(cardId => {
    const card = catalog.cards[cardId];
    return card?.effect_type === 'final_score_bonus';
  });
  if (hasHeirloomSeal) {
    const sealCard = Object.values(catalog.cards).find(c => c.effect_type === 'final_score_bonus');
    score += (sealCard?.effect_value as number) ?? 2;
  }

  return score;
}

// ─────────────────────────────────────────────
//  ИТОГОВЫЕ РЕЗУЛЬТАТЫ
// ─────────────────────────────────────────────

export function buildMatchResults(state: MatchState): MatchResults {
  const playerResults: PlayerResult[] = Object.values(state.players).map(player => ({
    id:          player.id,
    displayName: player.displayName,
    score:       calculateFinalScore(state, player.id),
    deliveries:  player.deliveriesCompleted,
    gold:        player.resources.gold,
    contracts:   player.completedContracts.length,
    licenses:    player.resources.licenses.length,
  }));

  // Сортировка: очки → золото → контракты → лицензии
  playerResults.sort((a, b) => {
    if (b.score !== a.score)     return b.score     - a.score;
    if (b.gold  !== a.gold)      return b.gold      - a.gold;
    if (b.contracts !== a.contracts) return b.contracts - a.contracts;
    return b.licenses - a.licenses;
  });

  return {
    players:  playerResults,
    winnerId: playerResults[0]!.id,
  };
}
