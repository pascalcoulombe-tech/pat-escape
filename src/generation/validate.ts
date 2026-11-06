import { INTERACT_RANGE, PLAYER_RADIUS, ROOM_SIZE } from '../domain/config';
import type { Id, Puzzle, ValidationIssue, Vec3, WorldDescription } from '../domain/types';
import type { LayoutDraft } from './layouts';
import { requirementIds, solve } from './solve';

/**
 * Contrôle spatial : grille de 0,25 m sur le plancher 6 × 6 m.
 * Une cellule est bloquée quand son centre tombe dans un volume de meuble
 * dilaté du rayon du joueur (0,30 m) sur X et Z. Les tapis ne bloquent pas.
 * Le joueur reste dans [0,30 m ; 5,70 m]. Une zone est accessible s'il existe
 * une cellule libre, reliée au spawn par un chemin orthogonal, à moins de 1,80 m
 * du point d'interaction. Ce contrôle ne remplace pas le solveur logique.
 */
const CELL = 0.25;

function issue(kind: ValidationIssue['kind'], id: Id, reason: string): ValidationIssue {
  return { kind, id, reason };
}

function cells(): number[] {
  const values: number[] = [];
  const min = PLAYER_RADIUS;
  const max = ROOM_SIZE - PLAYER_RADIUS;
  for (let value = min; value <= max + 1e-6; value += CELL) {
    values.push(Math.round(value * 1000) / 1000);
  }
  return values;
}

function blocked(layout: LayoutDraft, x: number, z: number): boolean {
  return layout.modules.some((module) => {
    if (!module.blocksMovement) return false;
    const { min, max } = module.collision;
    return (
      x >= min.x - PLAYER_RADIUS &&
      x <= max.x + PLAYER_RADIUS &&
      z >= min.z - PLAYER_RADIUS &&
      z <= max.z + PLAYER_RADIUS
    );
  });
}

export function spatialIssues(layout: LayoutDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (layout.modules.length !== 8) {
    issues.push(issue('spatial', layout.layoutId, 'La pièce doit contenir huit modules.'));
  }
  const grid = cells();
  const free: { x: number; z: number }[] = [];
  for (const x of grid) {
    for (const z of grid) {
      if (!blocked(layout, x, z)) free.push({ x, z });
    }
  }
  if (
    layout.spawn.x < PLAYER_RADIUS ||
    layout.spawn.z < PLAYER_RADIUS ||
    layout.spawn.x > ROOM_SIZE - PLAYER_RADIUS ||
    layout.spawn.z > ROOM_SIZE - PLAYER_RADIUS ||
    blocked(layout, layout.spawn.x, layout.spawn.z)
  ) {
    issues.push(issue('spatial', 'spawn', 'Le point de départ chevauche un obstacle.'));
  }
  let start: { x: number; z: number } | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const cell of free) {
    const distance = Math.hypot(cell.x - layout.spawn.x, cell.z - layout.spawn.z);
    if (distance < best) {
      best = distance;
      start = cell;
    }
  }
  if (!start || best > CELL) {
    issues.push(issue('spatial', 'spawn', 'Aucune cellule libre au point de départ.'));
    return issues;
  }
  const key = (x: number, z: number) => `${x},${z}`;
  const freeKeys = new Set(free.map((cell) => key(cell.x, cell.z)));
  const seen = new Set<string>([key(start.x, start.z)]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (!current) continue;
    for (const [dx, dz] of [
      [CELL, 0],
      [-CELL, 0],
      [0, CELL],
      [0, -CELL],
    ] as const) {
      const nextX = Math.round((current.x + dx) * 1000) / 1000;
      const nextZ = Math.round((current.z + dz) * 1000) / 1000;
      const id = key(nextX, nextZ);
      if (!freeKeys.has(id) || seen.has(id)) continue;
      seen.add(id);
      queue.push({ x: nextX, z: nextZ });
    }
  }
  const reachable = [...seen].map((id) => {
    const [x, z] = id.split(',').map(Number);
    return { x: x ?? 0, z: z ?? 0 };
  });
  const targets: { id: Id; point: Vec3 }[] = [
    ...layout.spots.map((spot) => ({ id: spot.id, point: spot.interaction })),
    { id: layout.exit.id, point: layout.exit.interaction },
  ];
  for (const target of targets) {
    const open = reachable.some(
      (cell) => Math.hypot(cell.x - target.point.x, cell.z - target.point.z) <= INTERACT_RANGE,
    );
    if (!open) {
      issues.push(
        issue(
          'spatial',
          target.id,
          `Zone inaccessible pour un joueur de rayon ${PLAYER_RADIUS.toFixed(2)} m et une portée de ${INTERACT_RANGE.toFixed(1)} m.`,
        ),
      );
    }
  }
  return issues;
}

function obtainable(world: WorldDescription, id: Id): boolean {
  return (
    world.spots.some((spot) => spot.contentIds.includes(id)) ||
    world.puzzles.some((puzzle) => puzzle.rewardIds.includes(id))
  );
}

function dependencies(world: WorldDescription, puzzle: Puzzle): Id[] {
  const deps = new Set<Id>();
  for (const need of requirementIds(puzzle)) {
    const producer = world.puzzles.find((candidate) => candidate.rewardIds.includes(need));
    if (producer) deps.add(producer.id);
  }
  for (const clue of puzzle.clueIds) {
    for (const spot of world.spots) {
      if (!spot.contentIds.includes(clue)) continue;
      for (const need of spot.requires) {
        const producer = world.puzzles.find((candidate) => candidate.rewardIds.includes(need));
        if (producer) deps.add(producer.id);
      }
    }
  }
  deps.delete(puzzle.id);
  return [...deps];
}

function hasCycle(world: WorldDescription): boolean {
  const graph = new Map(world.puzzles.map((puzzle) => [puzzle.id, dependencies(world, puzzle)]));
  const visiting = new Set<Id>();
  const visited = new Set<Id>();
  const visit = (id: Id): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of graph.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return world.puzzles.some((puzzle) => visit(puzzle.id));
}

function clueBehindOwnLock(world: WorldDescription, puzzle: Puzzle): boolean {
  const acquired = new Set<Id>();
  const solved = new Set<Id>();
  let progress = true;
  let guard = 0;
  while (progress && guard < 64) {
    guard += 1;
    progress = false;
    for (const spot of world.spots) {
      if (spot.requires.some((id) => !acquired.has(id))) continue;
      for (const content of spot.contentIds) {
        if (acquired.has(content)) continue;
        acquired.add(content);
        progress = true;
      }
    }
    for (const other of world.puzzles) {
      if (other.id === puzzle.id || solved.has(other.id)) continue;
      if (other.clueIds.some((id) => !acquired.has(id))) continue;
      if (requirementIds(other).some((id) => !acquired.has(id))) continue;
      if (other.family === 'combine') {
        for (const ingredient of other.ingredients) acquired.delete(ingredient);
      }
      for (const reward of other.rewardIds) acquired.add(reward);
      solved.add(other.id);
      progress = true;
    }
  }
  return puzzle.clueIds.some((id) => !acquired.has(id));
}

export function logicIssues(world: WorldDescription): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const families = new Set(world.puzzles.map((puzzle) => puzzle.family));
  if (families.size !== 4) {
    issues.push(issue('logic', 'familles', 'Familles incomplètes.'));
  }
  if (hasCycle(world)) {
    issues.push(issue('logic', 'cycle', 'Cycle de dépendances.'));
  }
  const consumedBy = new Map<Id, Id>();
  for (const puzzle of world.puzzles) {
    if (puzzle.clueIds.length === 0 || clueBehindOwnLock(world, puzzle)) {
      issues.push(issue('logic', puzzle.id, 'Indice derrière son propre verrou.'));
    }
    if (puzzle.family === 'code' && !/^\d{3}$/.test(puzzle.solution)) {
      issues.push(issue('logic', puzzle.id, 'Le code doit garder trois chiffres.'));
    }
    if (puzzle.family === 'symbols' && puzzle.solution.length !== 3) {
      issues.push(issue('logic', puzzle.id, 'Les symboles doivent être au nombre de trois.'));
    }
    if (puzzle.family === 'order' && puzzle.solution.length !== 3 && puzzle.solution.length !== 4) {
      issues.push(issue('logic', puzzle.id, "L'ordre doit compter trois ou quatre positions."));
    }
    if (puzzle.family !== 'combine') continue;
    for (const ingredient of puzzle.ingredients) {
      if (!obtainable(world, ingredient)) {
        issues.push(issue('logic', ingredient, 'Ingrédient manquant.'));
      }
      const previous = consumedBy.get(ingredient);
      if (previous) {
        issues.push(issue('logic', ingredient, 'Objet consommé requis plus d’une fois.'));
      } else {
        consumedBy.set(ingredient, puzzle.id);
      }
    }
  }
  for (const puzzle of world.puzzles) {
    for (const need of puzzle.requires) {
      const owner = consumedBy.get(need);
      if (owner && owner !== puzzle.id) {
        issues.push(issue('logic', need, 'Objet consommé requis plus d’une fois.'));
      }
    }
  }
  for (const spot of world.spots) {
    for (const need of spot.requires) {
      if (consumedBy.has(need)) {
        issues.push(issue('logic', need, 'Objet consommé requis plus d’une fois.'));
      }
    }
  }
  for (const puzzle of world.puzzles) {
    for (const reward of puzzle.rewardIds) {
      const used =
        world.exitRequires.includes(reward) ||
        world.puzzles.some(
          (other) =>
            other.id !== puzzle.id &&
            (other.requires.includes(reward) ||
              (other.family === 'combine' && other.ingredients.includes(reward))),
        ) ||
        world.spots.some((spot) => spot.requires.includes(reward));
      if (!used) issues.push(issue('logic', reward, 'Récompense inutilisée.'));
    }
  }
  if (world.exitRequires.length === 0 || world.exitRequires.some((id) => !obtainable(world, id)) || !solve(world).solvable) {
    issues.push(issue('logic', world.exit.id, 'Sortie inaccessible.'));
  }
  return issues;
}

export function validate(world: WorldDescription): readonly ValidationIssue[] {
  return [...logicIssues(world), ...spatialIssues(world)];
}
