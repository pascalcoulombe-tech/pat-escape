import { describe, expect, it } from 'vitest';
import { initialQuality, updateQuality } from '../src/runtime/quality';

describe('qualité mobile', () => {
  it('démarre à 1 et baisse après 5 secondes sous 25 images/s, plancher 0,65', () => {
    let state = initialQuality();
    expect(state.ratio).toBe(1);
    state = updateQuality(state, 20, 4_999);
    expect(state.ratio).toBe(1);
    state = updateQuality(state, 20, 1);
    expect(state.ratio).toBeCloseTo(0.9);
    state = updateQuality(state, 20, 5_000);
    state = updateQuality(state, 20, 5_000);
    state = updateQuality(state, 20, 5_000);
    expect(state.ratio).toBeCloseTo(0.65);
    const floor = updateQuality(state, 20, 5_000);
    expect(floor.ratio).toBeCloseTo(0.65);
  });

  it('remonte après 10 secondes au-dessus de 35 images/s, plafond 1', () => {
    let state = { ...initialQuality(), ratio: 0.8 };
    state = updateQuality(state, 40, 9_999);
    expect(state.ratio).toBeCloseTo(0.8);
    state = updateQuality(state, 40, 1);
    expect(state.ratio).toBeCloseTo(0.9);
    state = updateQuality({ ...state, ratio: 1 }, 40, 10_000);
    expect(state.ratio).toBe(1);
  });

  it('laisse le mode manuel stable et ignore la pause', () => {
    const manual = updateQuality({ ratio: 0.8, slowMs: 0, fastMs: 0, mode: 'manual' }, 10, 8_000);
    expect(manual).toEqual({ ratio: 0.8, slowMs: 0, fastMs: 0, mode: 'manual' });
    const paused = updateQuality(initialQuality(), 10, 0);
    expect(paused).toEqual(initialQuality());
  });
});
