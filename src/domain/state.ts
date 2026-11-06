import type { Answer, GameAction, GameState, Id, Puzzle, Transition, WorldDescription } from './types';

export function initialGame(_world: WorldDescription): GameState {
  return {
    discoveredIds: [],
    inventoryIds: [],
    consumedIds: [],
    solvedIds: [],
    journalIds: [],
    exitOpened: false,
  };
}

function transition(state: GameState, progressed: boolean, message: string): Transition {
  return { state, progressed, message };
}

function holds(state: GameState, id: Id): boolean {
  return state.inventoryIds.includes(id) && !state.consumedIds.includes(id);
}

function clueIdsOf(world: WorldDescription): ReadonlySet<Id> {
  return new Set(world.puzzles.flatMap((puzzle) => puzzle.clueIds));
}

function sameSequence(left: readonly Id[], right: readonly Id[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function samePair(left: readonly [Id, Id], right: readonly [Id, Id]): boolean {
  return (left[0] === right[0] && left[1] === right[1]) || (left[0] === right[1] && left[1] === right[0]);
}

function answerMatches(puzzle: Puzzle, answer: Answer): boolean {
  if (answer.family !== puzzle.family) return false;
  if (puzzle.family === 'code' && answer.family === 'code') return answer.value === puzzle.solution;
  if (puzzle.family === 'symbols' && answer.family === 'symbols') return sameSequence(answer.value, puzzle.solution);
  if (puzzle.family === 'order' && answer.family === 'order') return sameSequence(answer.value, puzzle.solution);
  if (puzzle.family === 'combine' && answer.family === 'combine') return samePair(answer.value, puzzle.ingredients);
  return false;
}

export function reduceGame(world: WorldDescription, state: GameState, action: GameAction): Transition {
  if (action.type === 'discover') {
    const spot = world.spots.find((candidate) => candidate.id === action.spotId);
    if (!spot) return transition(state, false, 'Rien ici.');
    if (spot.requires.some((id) => !holds(state, id))) {
      return transition(state, false, "C'est encore verrouillé.");
    }
    if (state.discoveredIds.includes(spot.id)) return transition(state, false, 'Tu as déjà regardé ici.');
    const clues = clueIdsOf(world);
    const journalIds = [...state.journalIds];
    for (const content of spot.contentIds) {
      if (clues.has(content) && !journalIds.includes(content)) journalIds.push(content);
    }
    return transition(
      { ...state, discoveredIds: [...state.discoveredIds, spot.id], journalIds },
      true,
      'Tu découvres quelque chose.',
    );
  }

  if (action.type === 'take') {
    const spot = world.spots.find((candidate) => candidate.id === action.spotId);
    const clues = clueIdsOf(world);
    if (!spot || !state.discoveredIds.includes(spot.id) || !spot.contentIds.includes(action.itemId)) {
      return transition(state, false, 'Tu ne peux pas prendre ça.');
    }
    if (clues.has(action.itemId)) return transition(state, false, 'Cette note est déjà dans le carnet.');
    if (state.inventoryIds.includes(action.itemId) || state.consumedIds.includes(action.itemId)) {
      return transition(state, false, 'Tu l’as déjà.');
    }
    const label = world.tokens.find((token) => token.id === action.itemId)?.label ?? 'objet';
    return transition(
      { ...state, inventoryIds: [...state.inventoryIds, action.itemId] },
      true,
      `Tu prends ${label}.`,
    );
  }

  if (action.type === 'submit') {
    const puzzle = world.puzzles.find((candidate) => candidate.id === action.puzzleId);
    if (!puzzle) return transition(state, false, 'Ce mécanisme n’existe pas.');
    if (action.answer.family !== puzzle.family) {
      return transition(state, false, 'Cette réponse ne va pas avec ce mécanisme.');
    }
    if (state.solvedIds.includes(puzzle.id)) return transition(state, false, 'C’est déjà résolu.');
    if (!state.discoveredIds.includes(puzzle.stationId)) {
      return transition(state, false, 'Tu n’as pas encore trouvé le mécanisme.');
    }
    if (puzzle.clueIds.some((id) => !state.journalIds.includes(id))) {
      return transition(state, false, 'Il te manque l’indice.');
    }
    const needs = puzzle.family === 'combine' ? [...puzzle.requires, ...puzzle.ingredients] : puzzle.requires;
    if (needs.some((id) => !holds(state, id))) {
      return transition(state, false, 'Il te manque encore quelque chose.');
    }
    if (!answerMatches(puzzle, action.answer)) {
      return transition(
        state,
        false,
        puzzle.family === 'combine' ? 'Ces objets ne vont pas ensemble.' : 'Ce n’est pas la bonne réponse.',
      );
    }
    const inventoryIds = state.inventoryIds.filter(
      (id) => puzzle.family !== 'combine' || !puzzle.ingredients.includes(id),
    );
    for (const reward of puzzle.rewardIds) {
      if (!inventoryIds.includes(reward)) inventoryIds.push(reward);
    }
    const consumedIds =
      puzzle.family === 'combine' ? [...state.consumedIds, ...puzzle.ingredients] : [...state.consumedIds];
    return transition(
      {
        ...state,
        inventoryIds,
        consumedIds,
        solvedIds: [...state.solvedIds, puzzle.id],
      },
      true,
      'Ça s’ouvre.',
    );
  }

  if (state.exitOpened) return transition(state, false, 'La sortie est déjà ouverte.');
  if (!world.exitRequires.every((id) => holds(state, id))) {
    return transition(state, false, 'La sortie reste fermée.');
  }
  return transition({ ...state, exitOpened: true }, true, 'La sortie est ouverte.');
}
