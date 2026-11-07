import type { InputFrame } from '../domain/types';

export type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;
export type ControlZones = Readonly<{ move: Rect; look: Rect }>;
export type PointerPoint = Readonly<{
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  zone: 'move' | 'look';
}>;

function inside(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

export function zoneAt(x: number, y: number, zones: ControlZones): 'move' | 'look' | 'none' {
  if (inside(x, y, zones.move)) return 'move';
  if (inside(x, y, zones.look)) return 'look';
  return 'none';
}

export function frameFromPointers(pointers: readonly PointerPoint[], sensitivity: number): InputFrame {
  let moveX = 0;
  let moveZ = 0;
  let lookX = 0;
  let lookY = 0;
  for (const pointer of pointers) {
    if (pointer.zone === 'move') {
      moveX += Math.max(-1, Math.min(1, (pointer.x - pointer.startX) / 72));
      moveZ += Math.max(-1, Math.min(1, -(pointer.y - pointer.startY) / 72));
    } else {
      lookX += (pointer.x - pointer.lastX) * 0.005 * sensitivity;
      lookY += -(pointer.y - pointer.lastY) * 0.005 * sensitivity;
    }
  }
  const length = Math.hypot(moveX, moveZ);
  if (length > 1) {
    moveX /= length;
    moveZ /= length;
  }
  return { moveX, moveZ, lookX, lookY, interact: false };
}
