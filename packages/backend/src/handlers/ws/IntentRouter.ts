import type { Intent, MatchState, ServerEvent, StateDiff, PlayerState, CardData } from '@caravan/shared';
import { ErrorCode }                             from '@caravan/shared';
import { getMatch, setMatch, broadcastToMatch, sendToPlayer } from '../../rooms/MatchStore.js';
import { validateMove }                           from '../../engine/match/RouteValidator.js';
import { applyMove, endTurn }                     from '../../engine/match/TurnEngine.js';
import { resolveNodeAction }                      from '../../engine/match/NodeResolver.js';
import { applyDiff }                              from '../../engine/match/MatchEngine.js';
import { buildMatchResults }                      from '../../engine/match/ScoringEngine.js';
import { aiChooseMove, aiChooseAction }           from '../../engine/ai/AIAgent.js';
import { getNodeById, loadMap }                   from '../../engine/map/MapLoader.js';
import { getGameCatalog }                         from '../../engine/cards/CatalogLoader.js';
import { nanoid }                                 from '../../utils/nanoid.js';

// ─────────────────────────────────────────────
//  MAIN ROUTER
// ─────────────────────────────────────────────

export async function handleIntent(
  matchId:  string,
  playerId: string,
  intent:   Intent,
): Promise<void> {
  const state = getMatch(matchId);

  if (!state) {
    sendToPlayer(matchId, playerId, {
      type: 'error', code: ErrorCode.MATCH_NOT_FOUND, message: 'Match not found',
    } satisfies ServerEvent);
    return;
  }

  switch (intent.type) {
    case 'reconnect_to_match':
      sendToPlayer(matchId, playerId, { type: 'reconnect_ok', state } satisfies ServerEvent);
      return;
    case 'move_to_node':
      await handleMove(matchId, playerId, state, intent.nodeId);
      return;
    case 'resolve_node_action':
      await handleNodeAction(matchId, playerId, state, intent.action);
      return;
    case 'play_card':
      await handlePlayCard(matchId, playerId, state, intent.cardId);
      return;
    case 'end_turn':
      await handleEndTurn(matchId, playerId, state);
      return;
    default:
      sendToPlayer(matchId, playerId, {
        type: 'error', code: ErrorCode.INVALID_INTENT,
        message: `Unknown intent: ${(intent as any).type}`,
      } satisfies ServerEvent);
  }
}

// ─────────────────────────────────────────────
//  MOVE
// ─────────────────────────────────────────────

async function handleMove(
  matchId: string, playerId: string, state: MatchState, nodeId: string,
): Promise<void> {
  const validation = validateMove(state, playerId, nodeId);
  if (!validation.valid) {
    sendToPlayer(matchId, playerId, {
      type: 'error', code: validation.reason ?? ErrorCode.INVALID_MOVE,
      message: `Cannot move to ${nodeId}`,
    } satisfies ServerEvent);
    return;
  }

  const fromNodeId = state.players[playerId]!.currentNodeId;
  const { state: nextState, diff } = applyMove(state, playerId, nodeId);
  setMatch(nextState);

  broadcastToMatch(matchId, { type: 'move_applied', playerId, fromNodeId, toNodeId: nodeId } satisfies ServerEvent);
  broadcastToMatch(matchId, { type: 'state_diff', diff } satisfies ServerEvent);

  const map      = loadMap(nextState.mapId);
  const nodeData = getNodeById(map, nodeId);
  broadcastToMatch(matchId, {
    type: 'node_activated', nodeId,
    availableActions: nodeData.actions as any,
  } satisfies ServerEvent);
}

// ─────────────────────────────────────────────
//  NODE ACTION
// ─────────────────────────────────────────────

async function handleNodeAction(
  matchId: string, playerId: string, state: MatchState,
  action: Extract<Intent, { type: 'resolve_node_action' }>['action'],
): Promise<void> {
  if (state.activePlayerId !== playerId) {
    sendToPlayer(matchId, playerId, {
      type: 'error', code: ErrorCode.NOT_YOUR_TURN, message: 'Not your turn',
    } satisfies ServerEvent);
    return;
  }

  const { diff, error } = resolveNodeAction(state, playerId, action);

  if (error) {
    sendToPlayer(matchId, playerId, {
      type: 'error', code: error, message: error,
    } satisfies ServerEvent);
    return;
  }

  const finalDiff: StateDiff = { ...diff, turnPhase: 'end' };
  const nextState = applyDiff(state, finalDiff);
  setMatch(nextState);

  if (action.kind === 'hub' && action.subAction === 'deliver') {
    const catalog  = getGameCatalog();
    const contract = catalog.contracts[action.contractId];
    broadcastToMatch(matchId, {
      type: 'delivery_completed', playerId, contractId: action.contractId,
      reward: {
        gold:      contract?.reward_gold      ?? 0,
        influence: contract?.reward_influence ?? 0,
        cargo:     0,
        score:     contract?.reward_score     ?? 0,
      },
    } satisfies ServerEvent);
  }

  broadcastToMatch(matchId, { type: 'state_diff', diff: finalDiff } satisfies ServerEvent);
}

// ─────────────────────────────────────────────
//  PLAY CARD
// ─────────────────────────────────────────────

async function handlePlayCard(
  matchId: string, playerId: string, state: MatchState, cardId: string,
): Promise<void> {
  if (state.activePlayerId !== playerId) {
    sendToPlayer(matchId, playerId, {
      type: 'error', code: ErrorCode.NOT_YOUR_TURN, message: 'Not your turn',
    } satisfies ServerEvent);
    return;
  }

  const player  = state.players[playerId]!;
  const catalog = getGameCatalog();
  const card    = catalog.cards[cardId];

  if (!card || !player.hand.includes(cardId)) {
    sendToPlayer(matchId, playerId, {
      type: 'error', code: ErrorCode.INVALID_INTENT, message: 'Card not in hand',
    } satisfies ServerEvent);
    return;
  }

  if (card.type === 'house_privilege') {
    sendToPlayer(matchId, playerId, {
      type: 'error', code: ErrorCode.INVALID_INTENT, message: 'House privilege cards are passive',
    } satisfies ServerEvent);
    return;
  }

  const newHand = player.hand.filter(id => id !== cardId);
  let updatedPlayer: PlayerState = { ...player, hand: newHand };
  updatedPlayer = applyCardEffect(updatedPlayer, card);

  const diff: StateDiff = {
    players:  { [playerId]: updatedPlayer },
    eventLog: [{
      id: nanoid(), round: state.round, playerId,
      type: 'play_card', description: `Сыграна карта: ${card.name}`, timestamp: Date.now(),
    }],
  };

  const nextState = applyDiff(state, diff);
  setMatch(nextState);
  broadcastToMatch(matchId, { type: 'state_diff', diff } satisfies ServerEvent);
}

function applyCardEffect(player: PlayerState, card: CardData): PlayerState {
  const r = { ...player.resources };
  switch (card.effect_type) {
    case 'instant_gold':          r.gold      += Number(card.effect_value); break;
    case 'instant_cargo':         r.cargo      = Math.min(r.cargo + Number(card.effect_value), 3); break;
    case 'instant_influence':     r.influence += Number(card.effect_value); break;
    case 'instant_gold_and_cargo':r.gold += 2; r.cargo = Math.min(r.cargo + 1, 3); break;
    case 'delivery_score_bonus':  break; // применяется в NodeResolver при доставке
    case 'move_bonus_once':       break; // применяется в RouteValidator
    case 'ignore_risky':          break; // применяется в NodeResolver
    default:                      break;
  }
  return { ...player, resources: r };
}

// ─────────────────────────────────────────────
//  END TURN
// ─────────────────────────────────────────────

async function handleEndTurn(
  matchId: string, playerId: string, state: MatchState,
): Promise<void> {
  if (state.activePlayerId !== playerId) {
    sendToPlayer(matchId, playerId, {
      type: 'error', code: ErrorCode.NOT_YOUR_TURN, message: 'Not your turn',
    } satisfies ServerEvent);
    return;
  }

  const { state: nextState, diff, matchOver } = endTurn(state, playerId);
  setMatch(nextState);
  broadcastToMatch(matchId, { type: 'state_diff', diff } satisfies ServerEvent);

  if (matchOver) {
    broadcastToMatch(matchId, {
      type: 'match_finished', results: buildMatchResults(nextState),
    } satisfies ServerEvent);
    return;
  }

  broadcastToMatch(matchId, {
    type: 'turn_started', playerId: nextState.activePlayerId, round: nextState.round,
  } satisfies ServerEvent);

  const nextPlayer = nextState.players[nextState.activePlayerId];
  if (nextPlayer?.isAI) {
    setTimeout(() => runAITurn(matchId, nextState.activePlayerId), 800);
  }
}

// ─────────────────────────────────────────────
//  AI TURN
// ─────────────────────────────────────────────

async function runAITurn(matchId: string, aiPlayerId: string): Promise<void> {
  broadcastToMatch(matchId, { type: 'ai_thinking' } satisfies ServerEvent);

  try {
    const s1 = getMatch(matchId);
    if (!s1 || s1.activePlayerId !== aiPlayerId) return;

    const chosenNode = aiChooseMove(s1, aiPlayerId);
    await sleep(500);
    await handleMove(matchId, aiPlayerId, s1, chosenNode);

    const s2 = getMatch(matchId);
    if (!s2 || s2.activePlayerId !== aiPlayerId) return;
    const action = aiChooseAction(s2, aiPlayerId);
    await sleep(400);
    await handleNodeAction(matchId, aiPlayerId, s2, action);

    const s3 = getMatch(matchId);
    if (!s3 || s3.activePlayerId !== aiPlayerId) return;
    await sleep(400);
    await handleEndTurn(matchId, aiPlayerId, s3);

  } catch {
    // Аварийное завершение хода AI
    const fallback = getMatch(matchId);
    if (fallback && fallback.activePlayerId === aiPlayerId) {
      const { state: ns, diff, matchOver } = endTurn(fallback, aiPlayerId);
      setMatch(ns);
      broadcastToMatch(matchId, { type: 'state_diff', diff } satisfies ServerEvent);
      if (matchOver) {
        broadcastToMatch(matchId, {
          type: 'match_finished', results: buildMatchResults(ns),
        } satisfies ServerEvent);
      }
    }
  } finally {
    broadcastToMatch(matchId, { type: 'ai_done' } satisfies ServerEvent);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
