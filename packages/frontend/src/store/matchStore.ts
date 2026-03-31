import { create }     from 'zustand';
import type { MatchState, PlayerState, NodeState, StateDiff, TurnPhase } from '@caravan/shared';

type ActiveModal = 'node_action' | 'delivery' | 'hand' | null;

type MatchStore = {
  // ── State ────────────────────────────────
  matchState:     MatchState | null;
  myPlayerId:     string | null;
  selectedNodeId: string | null;
  availableNodes: string[];
  activeModal:    ActiveModal;
  aiThinking:     boolean;
  toasts:         Toast[];

  // ── Actions ──────────────────────────────
  setMatchState:  (s: MatchState) => void;
  applyDiff:      (diff: StateDiff) => void;
  setMyPlayerId:  (id: string) => void;
  setSelectedNode:(id: string | null) => void;
  setAvailableNodes: (ids: string[]) => void;
  openModal:      (m: ActiveModal) => void;
  closeModal:     () => void;
  setAiThinking:  (v: boolean) => void;
  addToast:       (t: Omit<Toast, 'id'>) => void;
  removeToast:    (id: string) => void;
  reset:          () => void;
};

export type Toast = {
  id:      string;
  message: string;
  type:    'info' | 'error' | 'success';
};

let _toastId = 0;

export const useMatchStore = create<MatchStore>((set, get) => ({
  matchState:     null,
  myPlayerId:     null,
  selectedNodeId: null,
  availableNodes: [],
  activeModal:    null,
  aiThinking:     false,
  toasts:         [],

  setMatchState: (s) => set({ matchState: s }),

  applyDiff: (diff) => {
    const { matchState } = get();
    if (!matchState) return;

    let next = { ...matchState };

    if (diff.players) {
      next.players = { ...next.players };
      for (const [id, partial] of Object.entries(diff.players)) {
        if (partial) next.players[id] = { ...next.players[id]!, ...partial } as PlayerState;
      }
    }
    if (diff.nodes) {
      next.nodes = { ...next.nodes };
      for (const [id, partial] of Object.entries(diff.nodes)) {
        if (partial) next.nodes[id] = { ...next.nodes[id]!, ...partial } as NodeState;
      }
    }
    if (diff.contractPool  !== undefined) next.contractPool  = diff.contractPool;
    if (diff.usedContracts !== undefined) next.usedContracts = diff.usedContracts;
    if (diff.round         !== undefined) next.round         = diff.round;
    if (diff.activePlayerId!== undefined) next.activePlayerId= diff.activePlayerId;
    if (diff.turnPhase     !== undefined) next.turnPhase     = diff.turnPhase as TurnPhase;
    if (diff.status        !== undefined) next.status        = diff.status as any;
    if (diff.winner        !== undefined) next.winner        = diff.winner;
    if (diff.eventLog?.length) next.eventLog = [...next.eventLog, ...diff.eventLog];

    // Обновить availableNodes из статусов узлов
    const available = Object.entries(next.nodes)
      .filter(([, n]) => n.status === 'available')
      .map(([id]) => id);

    set({ matchState: next, availableNodes: available });
  },

  setMyPlayerId:     (id) => set({ myPlayerId: id }),
  setSelectedNode:   (id) => set({ selectedNodeId: id }),
  setAvailableNodes: (ids) => set({ availableNodes: ids }),
  openModal:         (m)   => set({ activeModal: m }),
  closeModal:        ()    => set({ activeModal: null }),
  setAiThinking:     (v)   => set({ aiThinking: v }),

  addToast: (t) => {
    const id = String(++_toastId);
    set(s => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => get().removeToast(id), 3000);
  },

  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  reset: () => set({
    matchState: null, selectedNodeId: null,
    availableNodes: [], activeModal: null,
    aiThinking: false, toasts: [],
  }),
}));

// Selectors
export const useMyPlayer = () => {
  const { matchState, myPlayerId } = useMatchStore();
  if (!matchState || !myPlayerId) return null;
  return matchState.players[myPlayerId] ?? null;
};

export const useIsMyTurn = () => {
  const { matchState, myPlayerId } = useMatchStore();
  if (!matchState || !myPlayerId) return false;
  return matchState.activePlayerId === myPlayerId;
};
