import { BACKGROUND_DELTA_MS, DIFFICULTIES, HINT_IDLE_MS } from './config';
import type { Difficulty, Id, SessionAction, SessionState } from './types';

export function initialSession(difficulty: Difficulty): SessionState {
  const config = DIFFICULTIES[difficulty];
  return {
    phase: 'intro',
    activeMs: 0,
    remainingMs: config.seconds * 1000,
    sinceProgressMs: 0,
    outOfTime: false,
    hintsUsed: 0,
    hintBudget: config.hints,
    hintLevels: {},
  };
}

export function hintOfferReady(state: SessionState): boolean {
  return (
    (state.phase === 'running' || state.phase === 'training') &&
    state.sinceProgressMs >= HINT_IDLE_MS &&
    state.hintsUsed < state.hintBudget
  );
}

export function sessionActionForVisibility(
  kind: 'blur' | 'hidden' | 'visible' | 'escape',
): SessionAction | null {
  if (kind === 'visible') return null;
  return { type: 'pause' };
}

export function reduceSession(state: SessionState, action: SessionAction): SessionState {
  if (action.type === 'start') {
    if (state.phase !== 'intro') return state;
    return { ...state, phase: 'running' };
  }
  if (action.type === 'pause') {
    if (state.phase !== 'running' && state.phase !== 'training') return state;
    return { ...state, phase: 'paused' };
  }
  if (action.type === 'resume') {
    if (state.phase !== 'paused') return state;
    return { ...state, phase: state.outOfTime ? 'training' : 'running' };
  }
  if (action.type === 'tick') {
    if (action.deltaMs <= 0 || action.deltaMs > BACKGROUND_DELTA_MS) return state;
    if (state.phase === 'training') {
      return { ...state, sinceProgressMs: state.sinceProgressMs + action.deltaMs };
    }
    if (state.phase !== 'running') return state;
    const consumed = Math.min(state.remainingMs, action.deltaMs);
    const remainingMs = state.remainingMs - consumed;
    return {
      ...state,
      activeMs: state.activeMs + consumed,
      remainingMs,
      sinceProgressMs: state.sinceProgressMs + action.deltaMs,
      phase: remainingMs === 0 ? 'expired' : 'running',
    };
  }
  if (action.type === 'progress') {
    if (state.phase !== 'running' && state.phase !== 'training') return state;
    return { ...state, sinceProgressMs: 0 };
  }
  if (action.type === 'continueTraining') {
    if (state.phase !== 'expired') return state;
    return { ...state, phase: 'training', outOfTime: true, remainingMs: 0 };
  }
  if (action.type === 'win') {
    if (state.phase !== 'running' && state.phase !== 'training') return state;
    return { ...state, phase: 'won', outOfTime: state.outOfTime || state.remainingMs === 0 };
  }
  const level = state.hintLevels[action.puzzleId] ?? 0;
  if (state.hintsUsed >= state.hintBudget || level >= 3) return state;
  return {
    ...state,
    hintsUsed: state.hintsUsed + 1,
    hintLevels: { ...state.hintLevels, [action.puzzleId]: level + 1 },
  };
}

export function hintLevel(state: SessionState, puzzleId: Id): number {
  return state.hintLevels[puzzleId] ?? 0;
}
