import { describe, expect, it } from 'vitest';
import { initialSession } from '../src/domain/session';
import { initialGame } from '../src/domain/state';
import { generate } from '../src/generation/generate';
import { formatSeedUrl, mintSeed, parseSeedUrl } from '../src/seed-url';

describe('adresses de graine', () => {
  it('fait l’aller-retour sans perdre la base', () => {
    const input = { seed: 'v1-0', difficulty: 'expert' as const, version: 1 as const };
    const formatted = formatSeedUrl(new URL('https://pascalcoulombe-tech.github.io/pat-escape/'), input);
    expect(formatted.pathname).toBe('/pat-escape/');
    expect(parseSeedUrl(formatted)).toEqual(input);
    expect([...formatted.searchParams.keys()].sort()).toEqual(['difficulty', 'seed', 'version']);
  });

  it('rejette une graine ou une version invalide en français, sans la corriger', () => {
    const seed = parseSeedUrl(
      new URL('https://pascalcoulombe-tech.github.io/pat-escape/?seed=mauvaise_graine&difficulty=expert&version=1'),
    );
    expect(seed).toEqual({ error: expect.stringMatching(/graine/i) });
    const version = parseSeedUrl(
      new URL('https://pascalcoulombe-tech.github.io/pat-escape/?seed=abc&difficulty=discovery&version=2'),
    );
    expect(version).toEqual({ error: expect.stringMatching(/version/i) });
    expect(JSON.stringify(version)).not.toContain('"version":1');
    const difficulty = parseSeedUrl(
      new URL('https://pascalcoulombe-tech.github.io/pat-escape/?seed=abc&difficulty=impossible&version=1'),
    );
    expect(difficulty).toEqual({ error: expect.stringMatching(/difficult/i) });
  });

  it('choisit une nouvelle graine différente et déterministe', () => {
    const entropy = [3, 9, 12, 4, 8, 1, 0, 7, 6, 5, 11, 2];
    const first = mintSeed(entropy, 'aaaaaaaaaaaa');
    const second = mintSeed(entropy, 'aaaaaaaaaaaa');
    expect(first).toBe(second);
    expect(first).not.toBe('aaaaaaaaaaaa');
    expect(first).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(mintSeed(entropy, first)).not.toBe(first);
  });

  it('remet la même graine à zéro et ne restaure aucun état depuis l’adresse', () => {
    const input = { seed: 'reset-1', difficulty: 'standard' as const, version: 1 as const };
    const world = generate(input);
    const played = {
      ...initialGame(world),
      solvedIds: [world.puzzles[0]?.id ?? 'x'],
      inventoryIds: ['objet'],
    };
    const session = reducePlayed();
    const reloaded = parseSeedUrl(
      formatSeedUrl(new URL('https://pascalcoulombe-tech.github.io/pat-escape/?inventory=secret&solved=1'), input),
    );
    expect(reloaded).toEqual(input);
    expect(JSON.stringify(reloaded)).not.toContain('secret');
    const freshWorld = generate(input);
    expect(freshWorld).toEqual(world);
    expect(initialGame(freshWorld)).toEqual(initialGame(world));
    expect(initialGame(freshWorld).solvedIds).toEqual([]);
    expect(initialSession(input.difficulty).phase).toBe('intro');
    expect(initialSession(input.difficulty).remainingMs).toBe(900_000);
    expect(played.solvedIds).not.toEqual(initialGame(freshWorld).solvedIds);
    expect(session.phase).not.toBe('intro');
  });
});

function reducePlayed() {
  return {
    ...initialSession('standard'),
    phase: 'running' as const,
    activeMs: 5_000,
    remainingMs: 895_000,
  };
}
