import type { Aabb, ExitDoor, LayoutId, Module, ModuleKind, Spot, ThemeId, Vec3 } from '../domain/types';

export const LAYOUT_IDS = ['perimetre', 'couloir', 'fer'] as const;
export const THEME_IDS = ['cabane', 'chalet', 'sous-sol'] as const;

export type LayoutDraft = Readonly<{
  theme: ThemeId;
  layoutId: LayoutId;
  spawn: Vec3;
  exit: ExitDoor;
  modules: readonly Module[];
  spots: readonly Spot[];
}>;

type Face = 'east' | 'west' | 'south' | 'north' | 'up';

type Furniture = Readonly<{
  kind: ModuleKind;
  label: string;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  blocks: boolean;
  face: Face;
}>;

const STATION_FAMILY = {
  pupitre: 'code',
  tableau: 'symbols',
  leviers: 'order',
  table: 'combine',
} as const;

const PERIMETRE: readonly Furniture[] = [
  { kind: 'commode', label: 'Commode', x: 0.1, z: 0.55, w: 0.7, d: 1.2, h: 1.15, blocks: true, face: 'east' },
  { kind: 'tableau', label: 'Tableau', x: 0.1, z: 2.0, w: 0.34, d: 1.05, h: 1.5, blocks: true, face: 'east' },
  { kind: 'coffre', label: 'Coffre', x: 0.1, z: 3.35, w: 0.7, d: 1.15, h: 0.85, blocks: true, face: 'east' },
  { kind: 'leviers', label: 'Leviers', x: 0.4, z: 5.48, w: 1.45, d: 0.36, h: 1.5, blocks: true, face: 'south' },
  { kind: 'etagere', label: 'Étagère', x: 5.22, z: 0.55, w: 0.66, d: 1.55, h: 1.85, blocks: true, face: 'west' },
  { kind: 'pupitre', label: 'Pupitre', x: 4.72, z: 2.75, w: 1.12, d: 0.72, h: 1.15, blocks: true, face: 'west' },
  { kind: 'table', label: 'Table', x: 4.58, z: 4.25, w: 1.25, d: 0.78, h: 0.8, blocks: true, face: 'west' },
  { kind: 'tapis', label: 'Tapis', x: 2.35, z: 2.45, w: 1.3, d: 1.45, h: 0.03, blocks: false, face: 'up' },
];

const COULOIR: readonly Furniture[] = [
  { kind: 'commode', label: 'Commode', x: 0.1, z: 0.45, w: 1.15, d: 1.0, h: 1.15, blocks: true, face: 'east' },
  { kind: 'coffre', label: 'Coffre', x: 0.1, z: 1.75, w: 1.15, d: 0.9, h: 0.85, blocks: true, face: 'east' },
  { kind: 'tableau', label: 'Tableau', x: 0.1, z: 2.95, w: 0.4, d: 1.05, h: 1.5, blocks: true, face: 'east' },
  { kind: 'leviers', label: 'Leviers', x: 0.1, z: 4.3, w: 1.15, d: 0.55, h: 1.5, blocks: true, face: 'east' },
  { kind: 'etagere', label: 'Étagère', x: 4.75, z: 0.45, w: 1.1, d: 1.45, h: 1.85, blocks: true, face: 'west' },
  { kind: 'pupitre', label: 'Pupitre', x: 4.6, z: 2.3, w: 1.25, d: 0.78, h: 1.15, blocks: true, face: 'west' },
  { kind: 'table', label: 'Table', x: 4.6, z: 3.7, w: 1.25, d: 0.85, h: 0.8, blocks: true, face: 'west' },
  { kind: 'tapis', label: 'Tapis', x: 2.55, z: 2.2, w: 0.9, d: 1.35, h: 0.03, blocks: false, face: 'up' },
];

const FER: readonly Furniture[] = [
  { kind: 'commode', label: 'Commode', x: 0.1, z: 0.5, w: 0.66, d: 1.25, h: 1.15, blocks: true, face: 'east' },
  { kind: 'coffre', label: 'Coffre', x: 0.1, z: 2.15, w: 0.66, d: 1.15, h: 0.85, blocks: true, face: 'east' },
  { kind: 'tableau', label: 'Tableau', x: 0.35, z: 5.48, w: 1.35, d: 0.36, h: 1.5, blocks: true, face: 'south' },
  { kind: 'leviers', label: 'Leviers', x: 4.3, z: 5.48, w: 1.35, d: 0.36, h: 1.5, blocks: true, face: 'south' },
  { kind: 'etagere', label: 'Étagère', x: 5.25, z: 0.5, w: 0.64, d: 1.55, h: 1.85, blocks: true, face: 'west' },
  { kind: 'pupitre', label: 'Pupitre', x: 4.8, z: 2.45, w: 1.05, d: 0.7, h: 1.15, blocks: true, face: 'west' },
  { kind: 'table', label: 'Table', x: 4.7, z: 3.75, w: 1.15, d: 0.75, h: 0.8, blocks: true, face: 'west' },
  { kind: 'tapis', label: 'Tapis', x: 2.15, z: 3.2, w: 1.7, d: 1.05, h: 0.03, blocks: false, face: 'up' },
];

const FURNITURE: Record<LayoutId, readonly Furniture[]> = {
  perimetre: PERIMETRE,
  couloir: COULOIR,
  fer: FER,
};

function aabb(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Aabb {
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

function interactionFor(item: Furniture): Vec3 {
  const maxX = item.x + item.w;
  const maxZ = item.z + item.d;
  const midX = item.x + item.w / 2;
  const midZ = item.z + item.d / 2;
  const y = item.face === 'up' ? 0.6 : Math.min(1.2, Math.max(0.7, item.h * 0.65));
  if (item.face === 'east') return { x: maxX + 0.45, y, z: midZ };
  if (item.face === 'west') return { x: item.x - 0.45, y, z: midZ };
  if (item.face === 'south') return { x: midX, y, z: item.z - 0.45 };
  if (item.face === 'north') return { x: midX, y, z: maxZ + 0.45 };
  return { x: midX, y, z: midZ };
}

export function buildLayout(layoutId: LayoutId, theme: ThemeId): LayoutDraft {
  const modules: Module[] = FURNITURE[layoutId].map((item) => {
    const collision = aabb(item.x, item.x + item.w, 0, item.h, item.z, item.z + item.d);
    return {
      id: item.kind,
      label: item.label,
      kind: item.kind,
      collision,
      interaction: interactionFor(item),
      blocksMovement: item.blocks,
    };
  });
  const spots: Spot[] = modules.map((module) => {
    const family = module.kind in STATION_FAMILY ? STATION_FAMILY[module.kind as keyof typeof STATION_FAMILY] : null;
    return {
      id: module.id,
      moduleId: module.id,
      label: module.label,
      role: family ? 'station' : 'hide',
      family,
      contentIds: [],
      requires: [],
      collision: module.collision,
      interaction: module.interaction,
    };
  });
  return {
    theme,
    layoutId,
    spawn: { x: 3, y: 0, z: 1.15 },
    exit: {
      id: 'sortie',
      label: 'Sortie',
      interaction: { x: 3, y: 1, z: 4.9 },
      collision: aabb(2.3, 3.7, 0, 2.4, 5.9, 6.2),
    },
    modules,
    spots,
  };
}

export function wallColliders(doorOpen: boolean): Aabb[] {
  const walls = [
    aabb(-0.25, 0, 0, 2.7, 0, 6),
    aabb(6, 6.25, 0, 2.7, 0, 6),
    aabb(0, 6, 0, 2.7, -0.25, 0),
    aabb(0, 2.3, 0, 2.7, 5.9, 6.25),
    aabb(3.7, 6, 0, 2.7, 5.9, 6.25),
  ];
  if (!doorOpen) walls.push(aabb(2.3, 3.7, 0, 2.4, 5.9, 6.25));
  return walls;
}

export function movementColliders(layout: LayoutDraft, doorOpen: boolean): Aabb[] {
  return [
    ...wallColliders(doorOpen),
    ...layout.modules.filter((module) => module.blocksMovement).map((module) => module.collision),
  ];
}
