import { describe, expect, it } from 'vitest';
import { PITCH_LIMIT } from '../src/domain/config';
import { clampPitch, lookFromPointer, movementFromKeys } from '../src/input/desktop';
import { frameFromPointers, zoneAt, type PointerPoint } from '../src/input/touch';

const zones = {
  move: { x: 0, y: 80, w: 200, h: 400 },
  look: { x: 200, y: 80, w: 200, h: 400 },
};

describe('clavier', () => {
  it('normalise la diagonale et accepte ZQSD, WASD et les flèches', () => {
    const diagonal = movementFromKeys(new Set(['KeyW', 'KeyD']));
    expect(Math.hypot(diagonal.moveX, diagonal.moveZ)).toBeCloseTo(1);
    expect(diagonal.moveZ).toBeGreaterThan(0);
    expect(diagonal.moveX).toBeGreaterThan(0);
    expect(movementFromKeys(new Set(['KeyZ', 'KeyQ']))).toEqual(movementFromKeys(new Set(['KeyW', 'KeyA'])));
    expect(movementFromKeys(new Set(['ArrowUp', 'ArrowLeft'])).moveZ).toBeGreaterThan(0);
    expect(movementFromKeys(new Set(['ArrowUp', 'ArrowLeft'])).moveX).toBeLessThan(0);
  });

  it('borne le regard et applique la sensibilité', () => {
    expect(clampPitch(4)).toBe(PITCH_LIMIT);
    expect(clampPitch(-4)).toBe(-PITCH_LIMIT);
    const slow = lookFromPointer(100, 0, 1);
    const fast = lookFromPointer(100, 0, 2);
    expect(fast.lookX).toBeCloseTo(slow.lookX * 2);
    expect(lookFromPointer(0, 40, 1).lookY).toBeLessThan(0);
  });
});

describe('tactile', () => {
  it('sépare le joystick, le regard et ignore une zone de bouton', () => {
    expect(zoneAt(40, 200, zones)).toBe('move');
    expect(zoneAt(300, 200, zones)).toBe('look');
    expect(zoneAt(20, 20, zones)).toBe('none');
    const move: PointerPoint = {
      id: 1,
      x: 90,
      y: 140,
      startX: 40,
      startY: 200,
      lastX: 40,
      lastY: 200,
      zone: 'move',
    };
    const look: PointerPoint = {
      id: 2,
      x: 360,
      y: 180,
      startX: 300,
      startY: 220,
      lastX: 300,
      lastY: 220,
      zone: 'look',
    };
    const frame = frameFromPointers([move, look], 1);
    expect(frame.moveX).toBeGreaterThan(0);
    expect(frame.moveZ).toBeGreaterThan(0);
    expect(frame.lookX).toBeGreaterThan(0);
    expect(frame.lookY).toBeGreaterThan(0);
    expect(frame.interact).toBe(false);
  });

  it('relâche le mouvement quand le pointeur est annulé', () => {
    const frame = frameFromPointers([], 1);
    expect(frame.moveX).toBe(0);
    expect(frame.moveZ).toBe(0);
    expect(frame.lookX).toBe(0);
    expect(frame.lookY).toBe(0);
  });
});
