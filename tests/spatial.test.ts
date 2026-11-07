import { describe, expect, it } from 'vitest';
import { INTERACT_RANGE, PLAYER_RADIUS } from '../src/domain/config';
import type { InputFrame } from '../src/domain/types';
import { generate } from '../src/generation/generate';
import { buildLayout, LAYOUT_IDS, THEME_IDS } from '../src/generation/layouts';
import { spatialIssues } from '../src/generation/validate';
import { createPhysics } from '../src/runtime/physics';

const FORWARD: InputFrame = { moveX: 0, moveZ: 1, lookX: 0, lookY: 0, interact: false };

describe('gabarits accessibles', () => {
  it('utilise un joueur de rayon 0,30 m et une portée de 1,8 m', () => {
    expect(PLAYER_RADIUS).toBeCloseTo(0.3);
    expect(INTERACT_RANGE).toBeCloseTo(1.8);
  });

  it('valide 3 gabarits × 3 ambiances', () => {
    expect(LAYOUT_IDS).toHaveLength(3);
    expect(THEME_IDS).toHaveLength(3);
    const signatures = new Set<string>();
    for (const layoutId of LAYOUT_IDS) {
      const collisions: string[] = [];
      for (const theme of THEME_IDS) {
        const layout = buildLayout(layoutId, theme);
        expect(layout.theme).toBe(theme);
        expect(layout.layoutId).toBe(layoutId);
        expect(layout.modules).toHaveLength(8);
        expect(new Set(layout.modules.map((module) => module.kind)).size).toBe(8);
        expect(layout.spots).toHaveLength(8);
        expect(layout.spawn.y).toBe(0);
        expect(spatialIssues(layout)).toEqual([]);
        collisions.push(JSON.stringify(layout.modules.map((module) => module.collision)));
      }
      expect(new Set(collisions).size).toBe(1);
      signatures.add(collisions[0] ?? '');
    }
    expect(signatures.size).toBe(3);
  });

  it('bloque le joueur sur un mur et une porte, puis le laisse sortir', async () => {
    const description = generate({ seed: 'physique-1', difficulty: 'discovery', version: 1 });
    const physics = await createPhysics(description);
    const start = physics.getPose();
    expect(start.position.x).toBeCloseTo(description.spawn.x, 1);
    expect(start.position.z).toBeCloseTo(description.spawn.z, 1);
    for (let step = 0; step < 60; step += 1) physics.step(FORWARD, 1 / 60);
    const paced = physics.getPose().position.z - start.position.z;
    expect(paced).toBeGreaterThan(1.6);
    expect(paced).toBeLessThan(2.3);
    physics.dispose();

    const blocked = await createPhysics(description);
    for (let step = 0; step < 240; step += 1) blocked.step(FORWARD, 1 / 60);
    expect(blocked.getPose().position.z).toBeLessThan(5.8);
    expect(blocked.getPose().position.x).toBeGreaterThan(0.2);
    expect(blocked.getPose().position.x).toBeLessThan(5.8);
    blocked.setDoorOpen(true);
    for (let step = 0; step < 180; step += 1) blocked.step(FORWARD, 1 / 60);
    expect(blocked.getPose().position.z).toBeGreaterThan(6);
    blocked.dispose();

    const west = await createPhysics(description);
    for (let step = 0; step < 180; step += 1) {
      west.step({ moveX: 0, moveZ: 1, lookX: 0, lookY: 0, interact: false }, 1 / 60);
    }
    const yaw = -Math.PI / 2;
    west.step({ moveX: 0, moveZ: 0, lookX: west.getPose().yaw - yaw, lookY: 0, interact: false }, 1 / 60);
    for (let step = 0; step < 180; step += 1) {
      west.step({ moveX: 0, moveZ: 1, lookX: 0, lookY: 0, interact: false }, 1 / 60);
    }
    expect(west.getPose().position.x).toBeGreaterThan(0.15);
    west.dispose();
  });

  it('signale une pièce rendue infranchissable', () => {
    const layout = buildLayout('perimetre', 'sous-sol');
    const blocked = {
      ...layout,
      modules: layout.modules.map((module, index) =>
        index === 0
          ? {
              ...module,
              blocksMovement: true,
              collision: {
                min: { x: 0, y: 0, z: 0 },
                max: { x: 6, y: 2, z: 6 },
              },
            }
          : module,
      ),
    };
    expect(spatialIssues(blocked).some((issue) => issue.kind === 'spatial')).toBe(true);
  });
});
