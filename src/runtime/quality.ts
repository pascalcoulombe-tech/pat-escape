import type { QualityState } from '../domain/types';

const STEP = 0.1;
const FLOOR = 0.65;
const CEILING = 1;

export function initialQuality(): QualityState {
  return { ratio: 1, slowMs: 0, fastMs: 0, mode: 'auto' };
}

function roundStep(value: number): number {
  return Math.round(value * 100) / 100;
}

export function updateQuality(state: QualityState, fps: number, activeDeltaMs: number): QualityState {
  if (state.mode === 'manual') return { ...state, slowMs: 0, fastMs: 0 };
  if (activeDeltaMs <= 0) return state;
  let { ratio, slowMs, fastMs } = state;
  if (fps < 25) {
    slowMs += activeDeltaMs;
    fastMs = 0;
    if (slowMs >= 5_000 && ratio > FLOOR) {
      ratio = Math.max(FLOOR, roundStep(ratio - STEP));
      slowMs = 0;
    }
  } else if (fps > 35) {
    fastMs += activeDeltaMs;
    slowMs = 0;
    if (fastMs >= 10_000 && ratio < CEILING) {
      ratio = Math.min(CEILING, roundStep(ratio + STEP));
      fastMs = 0;
    }
  } else {
    slowMs = 0;
    fastMs = 0;
  }
  return { ratio, slowMs, fastMs, mode: 'auto' };
}
