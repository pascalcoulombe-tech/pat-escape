import { describe, expect, it } from 'vitest';
import { doorVisualX } from '../src/runtime/scene';

describe('translation de la porte', () => {
  it('glisse en X de 3 à 1,05 sans changer les autres axes', () => {
    expect(doorVisualX(false, 3)).toBe(3);
    expect(doorVisualX(true, 3)).toBe(1.05);
  });
});
