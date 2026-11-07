import { describe, expect, it } from 'vitest';
import { initialGame } from '../src/domain/state';
import { hintOfferReady, initialSession, reduceSession } from '../src/domain/session';
import { patComment, selectHint } from '../src/domain/hints';
import { generate } from '../src/generation/generate';

describe('aides de Pat', () => {
  const world = generate({ seed: 'hints-1', difficulty: 'discovery', version: 1 });
  const game = initialGame(world);

  it('propose une aide après 90 secondes sans la consommer', () => {
    let session = reduceSession(initialSession('discovery'), { type: 'start' });
    for (let count = 0; count < 45; count += 1) {
      session = reduceSession(session, { type: 'tick', deltaMs: 2_000 });
    }
    expect(hintOfferReady(session)).toBe(true);
    expect(session.hintsUsed).toBe(0);
    selectHint(world, game, session);
    expect(session.hintsUsed).toBe(0);
    expect(session.hintLevels).toEqual({});
  });

  it('fait progresser les conseils jusqu’à une instruction concrète', () => {
    let session = reduceSession(initialSession('discovery'), { type: 'start' });
    const first = selectHint(world, game, session);
    expect(first?.level).toBe(1);
    const puzzle = world.puzzles.find((candidate) => candidate.id === first?.puzzleId);
    expect(puzzle?.family).toBe('code');
    if (!puzzle || puzzle.family !== 'code' || !first) return;
    expect(first.text).not.toContain(puzzle.solution);
    session = reduceSession(session, { type: 'hintUsed', puzzleId: first.puzzleId });
    const second = selectHint(world, game, session);
    expect(second?.level).toBe(2);
    expect(second?.text).not.toContain(puzzle.solution);
    session = reduceSession(session, { type: 'hintUsed', puzzleId: first.puzzleId });
    const third = selectHint(world, game, session);
    expect(third?.level).toBe(3);
    expect(third?.text).toContain(puzzle.solution);
    expect(session.hintsUsed).toBe(2);
  });

  it('n’aide pas une énigme inaccessible et refuse quand le budget est vide', () => {
    const first = world.puzzles[0];
    expect(first).toBeTruthy();
    if (!first) return;
    const skipped = selectHint(
      world,
      { ...game, solvedIds: [first.id] },
      reduceSession(initialSession('discovery'), { type: 'start' }),
    );
    expect(skipped).toBeNull();
    const broke = selectHint(world, game, {
      ...reduceSession(initialSession('expert'), { type: 'start' }),
      hintsUsed: 1,
    });
    expect(broke).toBeNull();
  });

  it('commente sans révéler une solution', () => {
    const comment = patComment(world, game);
    expect(comment.startsWith('Pat')).toBe(true);
    expect(comment).not.toMatch(/\d/);
    for (const puzzle of world.puzzles) {
      if (puzzle.family === 'code') expect(comment).not.toContain(puzzle.solution);
    }
  });
});
