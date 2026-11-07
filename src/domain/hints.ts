import type { GameState, HintChoice, Puzzle, SessionState, WorldDescription } from './types';

const COMMENTS = [
  'Pat : Je reste avec toi.',
  'Pat : Prends le temps de lire tes notes.',
  'Pat : La sortie attend, sans se presser.',
  'Pat : Regarde les meubles, pas seulement le centre.',
] as const;

function accessible(game: GameState, puzzle: Puzzle): boolean {
  if (game.solvedIds.includes(puzzle.id)) return false;
  const needs = puzzle.family === 'combine' ? [...puzzle.requires, ...puzzle.ingredients] : puzzle.requires;
  return needs.every((id) => game.inventoryIds.includes(id) && !game.consumedIds.includes(id));
}

function familyLabel(puzzle: Puzzle): string {
  if (puzzle.family === 'code') return 'le cadenas';
  if (puzzle.family === 'symbols') return 'les symboles';
  if (puzzle.family === 'order') return "l'ordre des mécanismes";
  return 'la combinaison';
}

function concrete(world: WorldDescription, puzzle: Puzzle): string {
  if (puzzle.family === 'code') return `Entre ${puzzle.solution} sur le cadenas, un chiffre à la fois.`;
  if (puzzle.family === 'symbols' || puzzle.family === 'order') {
    const labels = puzzle.solution.map(
      (id) => world.tokens.find((token) => token.id === id)?.label.toLowerCase() ?? id,
    );
    return puzzle.family === 'symbols'
      ? `Place les symboles ainsi : ${labels.join(', puis ')}.`
      : `Actionne ainsi : ${labels.join(', puis ')}.`;
  }
  const labels = puzzle.ingredients.map(
    (id) => world.tokens.find((token) => token.id === id)?.label.toLowerCase() ?? id,
  );
  return `Assemble ${labels.join(' avec ')}.`;
}

function hintText(world: WorldDescription, puzzle: Puzzle, level: number): string {
  const station = world.spots.find((spot) => spot.id === puzzle.stationId)?.label.toLowerCase() ?? 'mécanisme';
  if (level <= 1) return `Pat : Regarde autour du ${station}. L'indice n'est pas loin.`;
  if (level === 2) {
    const spot = world.spots.find((candidate) => candidate.contentIds.some((id) => puzzle.clueIds.includes(id)));
    return `Pat : La note est près de ${(spot?.label ?? 'un meuble').toLowerCase()}. Ça concerne ${familyLabel(puzzle)}.`;
  }
  return `Pat : ${concrete(world, puzzle)}`;
}

export function selectHint(
  world: WorldDescription,
  game: GameState,
  session: SessionState,
): HintChoice | null {
  for (const puzzle of world.puzzles) {
    if (!accessible(game, puzzle)) continue;
    const known = session.hintLevels[puzzle.id] ?? 0;
    if (known < 3 && session.hintsUsed < session.hintBudget) {
      const level = known + 1;
      return { puzzleId: puzzle.id, level, text: hintText(world, puzzle, level) };
    }
    if (known > 0) return { puzzleId: puzzle.id, level: known, text: hintText(world, puzzle, known) };
  }
  return null;
}

export function patComment(world: WorldDescription, game: GameState): string {
  void world;
  return COMMENTS[game.solvedIds.length % COMMENTS.length] ?? COMMENTS[0];
}
