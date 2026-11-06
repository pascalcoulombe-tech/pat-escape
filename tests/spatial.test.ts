import { describe, expect, it } from 'vitest';
import { INTERACT_RANGE, PLAYER_RADIUS } from '../src/domain/config';
import { buildLayout, LAYOUT_IDS, THEME_IDS } from '../src/generation/layouts';
import { spatialIssues } from '../src/generation/validate';

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
