import { describe, expect, it } from 'vitest';
import type { Answer, GameState, Puzzle, WorldDescription } from '../src/domain/types';
import { generate } from '../src/generation/generate';
import { solve } from '../src/generation/solve';
import { initialGame, reduceGame } from '../src/domain/state';

function answerOf(puzzle: Puzzle): Answer {
  if (puzzle.family === 'code') return { family: 'code', value: puzzle.solution };
  if (puzzle.family === 'symbols') return { family: 'symbols', value: [...puzzle.solution] };
  if (puzzle.family === 'order') return { family: 'order', value: [...puzzle.solution] };
  return { family: 'combine', value: [puzzle.ingredients[0], puzzle.ingredients[1]] };
}

function wrongAnswer(puzzle: Puzzle): Answer {
  if (puzzle.family === 'code') {
    return { family: 'code', value: puzzle.solution === '000' ? '001' : '000' };
  }
  if (puzzle.family === 'symbols') return { family: 'symbols', value: [...puzzle.solution].reverse() };
  if (puzzle.family === 'order') return { family: 'order', value: [...puzzle.solution].reverse() };
  return { family: 'combine', value: [puzzle.ingredients[0], puzzle.ingredients[0]] };
}

function applyTraceStep(world: WorldDescription, state: GameState, id: string): GameState {
  const spot = world.spots.find((candidate) => candidate.id === id);
  if (spot) {
    let next = reduceGame(world, state, { type: 'discover', spotId: spot.id }).state;
    for (const itemId of spot.contentIds) {
      if (world.puzzles.some((puzzle) => puzzle.clueIds.includes(itemId))) continue;
      next = reduceGame(world, next, { type: 'take', spotId: spot.id, itemId }).state;
    }
    return next;
  }
  const puzzle = world.puzzles.find((candidate) => candidate.id === id);
  if (!puzzle) return state;
  return reduceGame(world, state, { type: 'submit', puzzleId: puzzle.id, answer: answerOf(puzzle) }).state;
}

function stateBefore(world: WorldDescription, puzzleId: string): GameState {
  let state = initialGame(world);
  for (const id of solve(world).trace) {
    if (id === puzzleId) return state;
    state = applyTraceStep(world, state, id);
  }
  return state;
}

function play(world: WorldDescription): GameState {
  let state = initialGame(world);
  for (const id of solve(world).trace) state = applyTraceStep(world, state, id);
  return state;
}

describe('réponses des quatre familles', () => {
  const world = generate({ seed: 'state-1', difficulty: 'discovery', version: 1 });

  it('refuse une mauvaise réponse sans perte, puis accepte la bonne', () => {
    for (const puzzle of world.puzzles) {
      const before = stateBefore(world, puzzle.id);
      const inventory = [...before.inventoryIds];
      const journal = [...before.journalIds];
      const wrong = reduceGame(world, before, {
        type: 'submit',
        puzzleId: puzzle.id,
        answer: wrongAnswer(puzzle),
      });
      expect(wrong.progressed).toBe(false);
      expect(wrong.state.inventoryIds).toEqual(inventory);
      expect(wrong.state.journalIds).toEqual(journal);
      expect(wrong.state.consumedIds).toEqual(before.consumedIds);
      expect(wrong.message.length).toBeGreaterThan(0);
      const right = reduceGame(world, before, {
        type: 'submit',
        puzzleId: puzzle.id,
        answer: answerOf(puzzle),
      });
      expect(right.progressed).toBe(true);
      expect(right.state.solvedIds).toContain(puzzle.id);
      for (const reward of puzzle.rewardIds) expect(right.state.inventoryIds).toContain(reward);
    }
  });

  it('conserve les zéros initiaux du code', () => {
    let found = false;
    for (let index = 0; index < 80 && !found; index += 1) {
      const seeded = generate({ seed: `v1-${index}`, difficulty: 'discovery', version: 1 });
      for (const puzzle of seeded.puzzles) {
        if (puzzle.family !== 'code' || !puzzle.solution.startsWith('0')) continue;
        found = true;
        const before = stateBefore(seeded, puzzle.id);
        const stripped = puzzle.solution.replace(/^0+/, '') || '0';
        const bad = reduceGame(seeded, before, {
          type: 'submit',
          puzzleId: puzzle.id,
          answer: { family: 'code', value: stripped },
        });
        expect(bad.progressed).toBe(false);
        const good = reduceGame(seeded, before, {
          type: 'submit',
          puzzleId: puzzle.id,
          answer: { family: 'code', value: puzzle.solution },
        });
        expect(good.progressed).toBe(true);
        expect(puzzle.solution).toHaveLength(3);
      }
    }
    expect(found).toBe(true);
  });

  it('refuse un mélange de familles', () => {
    const puzzle = world.puzzles.find((candidate) => candidate.family === 'code');
    expect(puzzle).toBeTruthy();
    if (!puzzle) return;
    const before = stateBefore(world, puzzle.id);
    const mixed = reduceGame(world, before, {
      type: 'submit',
      puzzleId: puzzle.id,
      answer: { family: 'symbols', value: ['a', 'b', 'c'] },
    });
    expect(mixed.progressed).toBe(false);
    expect(mixed.state).toEqual(before);
    expect(mixed.message).toMatch(/mécanisme|famille/i);
  });
});

describe('inventaire, carnet et sortie', () => {
  const world = generate({ seed: 'state-1', difficulty: 'discovery', version: 1 });

  it('refuse une prise inaccessible et ne donne une récompense qu’une fois', () => {
    const locked = world.spots.find((spot) => spot.requires.length > 0 && spot.contentIds.length > 0);
    expect(locked).toBeTruthy();
    if (!locked) return;
    const itemId = locked.contentIds[0] ?? '';
    const denied = reduceGame(world, initialGame(world), { type: 'take', spotId: locked.id, itemId });
    expect(denied.progressed).toBe(false);
    expect(denied.state.inventoryIds).toEqual([]);
    const puzzle = world.puzzles[0];
    expect(puzzle).toBeTruthy();
    if (!puzzle) return;
    const ready = stateBefore(world, puzzle.id);
    const first = reduceGame(world, ready, { type: 'submit', puzzleId: puzzle.id, answer: answerOf(puzzle) });
    const second = reduceGame(world, first.state, {
      type: 'submit',
      puzzleId: puzzle.id,
      answer: answerOf(puzzle),
    });
    expect(second.progressed).toBe(false);
    expect(second.state.inventoryIds.filter((id) => puzzle.rewardIds.includes(id))).toHaveLength(
      puzzle.rewardIds.length,
    );
  });

  it('consomme la bonne recette une seule fois et garde le carnet', () => {
    const puzzle = world.puzzles.find((candidate) => candidate.family === 'combine');
    expect(puzzle && puzzle.family === 'combine').toBe(true);
    if (!puzzle || puzzle.family !== 'combine') return;
    const before = stateBefore(world, puzzle.id);
    const reversed = reduceGame(world, before, {
      type: 'submit',
      puzzleId: puzzle.id,
      answer: { family: 'combine', value: [puzzle.ingredients[1], puzzle.ingredients[0]] },
    });
    expect(reversed.progressed).toBe(true);
    for (const ingredient of puzzle.ingredients) {
      expect(reversed.state.inventoryIds).not.toContain(ingredient);
      expect(reversed.state.consumedIds).toContain(ingredient);
    }
    expect(reversed.state.inventoryIds).toContain(puzzle.resultId);
    expect(reversed.state.journalIds).toEqual(expect.arrayContaining([...puzzle.clueIds]));
    const again = reduceGame(world, reversed.state, {
      type: 'submit',
      puzzleId: puzzle.id,
      answer: { family: 'combine', value: [...puzzle.ingredients] },
    });
    expect(again.progressed).toBe(false);
    expect(again.state.consumedIds.filter((id) => puzzle.ingredients.includes(id))).toHaveLength(2);
  });

  it('n’a pas de limite d’inventaire et bloque la sortie trop tôt', () => {
    const early = reduceGame(world, initialGame(world), { type: 'openExit' });
    expect(early.state.exitOpened).toBe(false);
    expect(early.message).toMatch(/sortie/i);
    const finished = play(world);
    expect(finished.inventoryIds.length).toBeGreaterThan(2);
    expect(finished.journalIds.length).toBe(world.puzzles.length);
    const opened = reduceGame(world, finished, { type: 'openExit' });
    expect(opened.progressed).toBe(true);
    expect(opened.state.exitOpened).toBe(true);
    const reopened = reduceGame(world, opened.state, { type: 'openExit' });
    expect(reopened.progressed).toBe(false);
    expect(reopened.state.exitOpened).toBe(true);
  });

  it('ne mute ni le monde ni l’état d’entrée', () => {
    const state = initialGame(world);
    const stateCopy = structuredClone(state);
    const contentCopy = world.spots.map((spot) => [...spot.contentIds]);
    reduceGame(world, state, { type: 'discover', spotId: world.spots[0]?.id ?? '' });
    expect(state).toEqual(stateCopy);
    expect(world.spots.map((spot) => [...spot.contentIds])).toEqual(contentCopy);
  });
});

describe('accord solveur et moteur', () => {
  it('rejoue la trace sur une graine de chaque difficulté', () => {
    for (const difficulty of ['discovery', 'standard', 'expert'] as const) {
      const world = generate({ seed: 'accord-1', difficulty, version: 1 });
      const traced = solve(world);
      expect(traced.solvable).toBe(true);
      let state = initialGame(world);
      for (const id of traced.trace) {
        const before = state.solvedIds.length;
        state = applyTraceStep(world, state, id);
        if (world.puzzles.some((puzzle) => puzzle.id === id)) {
          expect(state.solvedIds.length).toBe(before + 1);
        }
      }
      const exit = reduceGame(world, state, { type: 'openExit' });
      expect(exit.state.exitOpened, difficulty).toBe(true);
      expect(exit.state.solvedIds).toHaveLength(world.puzzles.length);
    }
  });
});
