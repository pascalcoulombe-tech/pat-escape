import { PITCH_LIMIT } from '../domain/config';

const FORWARD = new Set(['KeyW', 'KeyZ', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'KeyQ', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function movementFromKeys(keys: ReadonlySet<string>): { moveX: number; moveZ: number } {
  let moveX = 0;
  let moveZ = 0;
  for (const key of keys) {
    if (FORWARD.has(key)) moveZ += 1;
    if (BACK.has(key)) moveZ -= 1;
    if (RIGHT.has(key)) moveX += 1;
    if (LEFT.has(key)) moveX -= 1;
  }
  const length = Math.hypot(moveX, moveZ);
  if (length > 1) {
    moveX /= length;
    moveZ /= length;
  }
  return { moveX, moveZ };
}

export function lookFromPointer(dx: number, dy: number, sensitivity: number): { lookX: number; lookY: number } {
  const scale = 0.0022 * sensitivity;
  return { lookX: dx * scale, lookY: -dy * scale };
}

export function clampPitch(pitch: number): number {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
}
