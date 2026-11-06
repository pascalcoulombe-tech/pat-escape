import type { Id, Puzzle, SolveResult, WorldDescription } from '../domain/types';

export function requirementIds(puzzle: Puzzle): readonly Id[] {
  if (puzzle.family === 'combine') return [...puzzle.requires, ...puzzle.ingredients];
  return puzzle.requires;
}

export function solve(world: WorldDescription): SolveResult {
  const acquired = new Set<Id>();
  const consumed = new Set<Id>();
  const solved = new Set<Id>();
  const opened = new Set<Id>();
  const trace: Id[] = [];
  let progress = true;
  let guard = 0;
  while (progress && guard < 64) {
    guard += 1;
    progress = false;
    for (const spot of world.spots) {
      if (opened.has(spot.id)) continue;
      if (spot.requires.some((id) => !acquired.has(id) || consumed.has(id))) continue;
      opened.add(spot.id);
      trace.push(spot.id);
      for (const content of spot.contentIds) {
        if (!consumed.has(content)) acquired.add(content);
      }
      progress = true;
    }
    for (const puzzle of world.puzzles) {
      if (solved.has(puzzle.id)) continue;
      if (puzzle.clueIds.some((id) => !acquired.has(id))) continue;
      if (requirementIds(puzzle).some((id) => !acquired.has(id) || consumed.has(id))) continue;
      if (puzzle.family === 'combine') {
        for (const ingredient of puzzle.ingredients) {
          consumed.add(ingredient);
          acquired.delete(ingredient);
        }
      }
      for (const reward of puzzle.rewardIds) acquired.add(reward);
      solved.add(puzzle.id);
      trace.push(puzzle.id);
      progress = true;
    }
  }
  const exitReady = world.exitRequires.every((id) => acquired.has(id) && !consumed.has(id));
  return {
    solvable: exitReady && world.puzzles.length > 0 && solved.size === world.puzzles.length,
    acquired: [...acquired].sort(),
    trace,
  };
}
