import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, readSeedInput } from '../src/domain/config';
import type { Difficulty, Puzzle, Spot, Token, WorldDescription } from '../src/domain/types';
import { generate } from '../src/generation/generate';
import { buildLayout } from '../src/generation/layouts';
import { createRng, rngFor } from '../src/generation/random';
import { solve } from '../src/generation/solve';
import { validate } from '../src/generation/validate';

describe('difficultés', () => {
  it('fixe 4/6/8 énigmes, 1200/900/600 secondes et 6/3/1 aides', () => {
    expect(DIFFICULTIES.discovery).toEqual({
      puzzles: 4,
      seconds: 1200,
      hints: 6,
      label: 'Découverte',
    });
    expect(DIFFICULTIES.standard).toEqual({
      puzzles: 6,
      seconds: 900,
      hints: 3,
      label: 'Standard',
    });
    expect(DIFFICULTIES.expert).toEqual({
      puzzles: 8,
      seconds: 600,
      hints: 1,
      label: 'Expert',
    });
  });
});

describe('frontière des graines', () => {
  it('accepte une graine de 1 à 64 caractères alphanumériques ou tirets', () => {
    expect(readSeedInput({ seed: 'v1-0', difficulty: 'discovery', version: 1 })).toEqual({
      seed: 'v1-0',
      difficulty: 'discovery',
      version: 1,
    });
    expect(readSeedInput({ seed: 'A', difficulty: 'expert', version: 1 })).toEqual({
      seed: 'A',
      difficulty: 'expert',
      version: 1,
    });
    expect(readSeedInput({ seed: 'a'.repeat(64), difficulty: 'standard', version: 1 })).toMatchObject({
      seed: 'a'.repeat(64),
      version: 1,
    });
  });

  it('refuse une graine vide, trop longue ou hors alphabet, en français', () => {
    for (const seed of ['', ' ', 'a'.repeat(65), 'avec espace', 'éclaire', 'v1_0', 'pat.escape']) {
      const result = readSeedInput({ seed, difficulty: 'discovery', version: 1 });
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toMatch(/graine/i);
      expect((result as { error: string }).error).not.toBe(seed);
    }
  });

  it('refuse une difficulté inconnue et une version autre que 1, sans la modifier', () => {
    const difficulty = readSeedInput({ seed: 'abc', difficulty: 'hard', version: 1 });
    expect(difficulty).toEqual({ error: expect.stringMatching(/difficult/i) });
    const version = readSeedInput({ seed: 'abc', difficulty: 'expert', version: 2 });
    expect(version).toEqual({ error: expect.stringMatching(/version/i) });
    expect(JSON.stringify(version)).not.toContain('"version":1');
  });
});

describe('générateur aléatoire', () => {
  it('reproduit la même séquence pour la même graine', () => {
    const left = createRng('pat-1');
    const right = createRng('pat-1');
    const first = [left(), left(), left(), left(), left()];
    const second = [right(), right(), right(), right(), right()];
    expect(first).toEqual(second);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  it('produit une autre séquence pour une autre graine', () => {
    const left = createRng('pat-1');
    const right = createRng('pat-2');
    expect([left(), left(), left()]).not.toEqual([right(), right(), right()]);
  });

  it('mélange graine, difficulté et version sans Date ni Math.random', () => {
    const discovery = rngFor({ seed: 'v1-0', difficulty: 'discovery', version: 1 });
    const again = rngFor({ seed: 'v1-0', difficulty: 'discovery', version: 1 });
    expect([discovery(), discovery(), discovery()]).toEqual([again(), again(), again()]);

    const expert = rngFor({ seed: 'v1-0', difficulty: 'expert', version: 1 });
    const expertAgain = rngFor({ seed: 'v1-0', difficulty: 'expert', version: 1 });
    expect([expert(), expert(), expert()]).toEqual([expertAgain(), expertAgain(), expertAgain()]);

    const discoveryStream = rngFor({ seed: 'v1-0', difficulty: 'discovery', version: 1 });
    const expertStream = rngFor({ seed: 'v1-0', difficulty: 'expert', version: 1 });
    expect([discoveryStream(), discoveryStream()]).not.toEqual([expertStream(), expertStream()]);

    const source = fs.readFileSync(path.join('src/generation/random.ts'), 'utf8');
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/\bDate\b/);
  });
});

function fixture(overrides: {
  puzzles: readonly Puzzle[];
  tokens: readonly Token[];
  exitRequires: readonly string[];
  spots?: readonly Spot[];
  initialIds?: readonly string[];
}): WorldDescription {
  const layout = buildLayout('perimetre', 'cabane');
  const spots = overrides.spots ?? layout.spots;
  return {
    input: { seed: 'fixture', difficulty: 'discovery', version: 1 },
    theme: 'cabane',
    layoutId: 'perimetre',
    spawn: layout.spawn,
    exit: layout.exit,
    modules: layout.modules,
    spots,
    tokens: overrides.tokens,
    puzzles: overrides.puzzles,
    initialIds: overrides.initialIds ?? spots.flatMap((spot) => (spot.requires.length === 0 ? spot.contentIds : [])),
    exitRequires: overrides.exitRequires,
    fallback: false,
  };
}

function token(id: string, label: string, symbol = 'note', color = 'ocre'): Token {
  return { id, label, symbol, color };
}

describe('fixtures de solvabilité', () => {
  it('accepte une graine soluble qui contient les quatre familles', () => {
    const world = generate({ seed: 'soluble-4', difficulty: 'discovery', version: 1 });
    expect(world.puzzles).toHaveLength(4);
    expect(new Set(world.puzzles.map((puzzle) => puzzle.family))).toEqual(
      new Set(['code', 'symbols', 'order', 'combine']),
    );
    expect(validate(world)).toEqual([]);
    const solved = solve(world);
    expect(solved.solvable).toBe(true);
    expect(solved.acquired).toEqual(expect.arrayContaining([...world.exitRequires]));
  });

  it('rejette un cycle indirect', () => {
    const world = fixture({
      tokens: [token('key-a', 'Clé A', 'cle', 'rouge'), token('key-b', 'Clé B', 'cle', 'bleu'), token('key-c', 'Clé C', 'cle', 'vert'), token('clue-a', 'Note A'), token('clue-b', 'Note B'), token('clue-c', 'Note C')],
      exitRequires: ['key-c'],
      puzzles: [
        { id: 'a', family: 'code', solution: '123', requires: ['key-c'], clueIds: ['clue-a'], rewardIds: ['key-a'], stationId: 'pupitre' },
        { id: 'b', family: 'symbols', solution: ['s1', 's2', 's3'], requires: ['key-a'], clueIds: ['clue-b'], rewardIds: ['key-b'], stationId: 'tableau' },
        { id: 'c', family: 'order', solution: ['o1', 'o2', 'o3'], requires: ['key-b'], clueIds: ['clue-c'], rewardIds: ['key-c'], stationId: 'leviers' },
      ],
    });
    expect(validate(world).map((issue) => issue.reason).join(' ')).toMatch(/cycle/i);
    expect(solve(world).solvable).toBe(false);
  });

  it('rejette un indice derrière son propre verrou', () => {
    const layout = buildLayout('perimetre', 'cabane');
    const spots = layout.spots.map((spot) => {
      if (spot.id === 'commode') return { ...spot, contentIds: ['clue-a'], requires: ['key-b'] };
      if (spot.id === 'etagere') return { ...spot, contentIds: ['clue-b'], requires: [] };
      return { ...spot, contentIds: [], requires: [] };
    });
    const world = fixture({
      spots,
      tokens: [token('key-a', 'Clé A', 'cle', 'rouge'), token('key-b', 'Clé B', 'cle', 'bleu'), token('clue-a', 'Note A'), token('clue-b', 'Note B')],
      exitRequires: ['key-b'],
      puzzles: [
        { id: 'a', family: 'code', solution: '042', requires: [], clueIds: ['clue-a'], rewardIds: ['key-a'], stationId: 'pupitre' },
        { id: 'b', family: 'symbols', solution: ['s1', 's2', 's3'], requires: ['key-a'], clueIds: ['clue-b'], rewardIds: ['key-b'], stationId: 'tableau' },
      ],
    });
    expect(validate(world).some((issue) => issue.kind === 'logic' && /verrou/i.test(issue.reason))).toBe(true);
    expect(solve(world).solvable).toBe(false);
  });

  it('rejette un ingrédient manquant', () => {
    const world = fixture({
      tokens: [token('clue-c', 'Recette'), token('resultat', 'Assemblage', 'noeud', 'brun')],
      exitRequires: ['resultat'],
      puzzles: [
        {
          id: 'c',
          family: 'combine',
          ingredients: ['introuvable', 'manquant'],
          resultId: 'resultat',
          requires: [],
          clueIds: ['clue-c'],
          rewardIds: ['resultat'],
          stationId: 'table',
        },
      ],
    });
    expect(validate(world).map((issue) => issue.reason).join(' ')).toMatch(/ingrédient/i);
    expect(solve(world).solvable).toBe(false);
  });

  it('rejette un objet consommé qui est requis deux fois', () => {
    const layout = buildLayout('perimetre', 'cabane');
    const spots = layout.spots.map((spot) => {
      if (spot.id === 'commode') return { ...spot, contentIds: ['ficelle', 'clue-1', 'clue-2'], requires: [] };
      if (spot.id === 'etagere') return { ...spot, contentIds: ['crochet', 'huile'], requires: [] };
      return { ...spot, contentIds: [], requires: [] };
    });
    const world = fixture({
      spots,
      tokens: [
        token('ficelle', 'Ficelle', 'corde', 'brun'),
        token('crochet', 'Crochet', 'crochet', 'gris'),
        token('huile', 'Huile', 'fiole', 'jaune'),
        token('clue-1', 'Recette 1'),
        token('clue-2', 'Recette 2'),
        token('resultat-1', 'Assemblage 1', 'noeud', 'brun'),
        token('resultat-2', 'Assemblage 2', 'noeud', 'brun'),
      ],
      exitRequires: ['resultat-2'],
      puzzles: [
        {
          id: 'c1',
          family: 'combine',
          ingredients: ['ficelle', 'crochet'],
          resultId: 'resultat-1',
          requires: [],
          clueIds: ['clue-1'],
          rewardIds: ['resultat-1'],
          stationId: 'table',
        },
        {
          id: 'c2',
          family: 'combine',
          ingredients: ['ficelle', 'huile'],
          resultId: 'resultat-2',
          requires: [],
          clueIds: ['clue-2'],
          rewardIds: ['resultat-2'],
          stationId: 'table',
        },
      ],
    });
    expect(validate(world).map((issue) => issue.reason).join(' ')).toMatch(/consomm/i);
    expect(solve(world).solvable).toBe(false);
  });

  it('rejette une sortie inaccessible', () => {
    const world = fixture({
      tokens: [token('clue-a', 'Note'), token('key-a', 'Clé', 'cle', 'rouge')],
      exitRequires: ['cle-absente'],
      puzzles: [
        { id: 'a', family: 'code', solution: '111', requires: [], clueIds: ['clue-a'], rewardIds: ['key-a'], stationId: 'pupitre' },
      ],
    });
    expect(validate(world).map((issue) => issue.reason).join(' ')).toMatch(/sortie/i);
    expect(solve(world).solvable).toBe(false);
  });
});

describe('corpus déterministe', () => {
  it('valide 1000 graines par difficulté', () => {
    const codes = new Set<string>();
    const orders = new Set<string>();
    const hides = new Set<string>();
    let count = 0;
    const difficulties: Difficulty[] = ['discovery', 'standard', 'expert'];
    for (const difficulty of difficulties) {
      for (let index = 0; index < 1000; index += 1) {
        const input = { seed: `v1-${index}`, difficulty, version: 1 as const };
        const first = generate(input);
        const second = generate(input);
        expect(second).toEqual(first);
        expect(first.puzzles).toHaveLength(DIFFICULTIES[difficulty].puzzles);
        expect(first.modules).toHaveLength(8);
        expect(new Set(first.puzzles.map((puzzle) => puzzle.family))).toEqual(
          new Set(['code', 'symbols', 'order', 'combine']),
        );
        for (const puzzle of first.puzzles) {
          if (puzzle.family === 'code') {
            expect(puzzle.solution).toMatch(/^\d{3}$/);
            codes.add(puzzle.solution);
          } else if (puzzle.family === 'symbols') {
            expect(puzzle.solution).toHaveLength(3);
          } else if (puzzle.family === 'order') {
            expect([3, 4]).toContain(puzzle.solution.length);
            orders.add(puzzle.solution.join('>'));
          } else {
            expect(puzzle.ingredients).toHaveLength(2);
            expect(puzzle.rewardIds).toContain(puzzle.resultId);
          }
        }
        expect(validate(first), `${input.seed} ${difficulty}`).toEqual([]);
        const solved = solve(first);
        expect(solved.solvable, `${input.seed} ${difficulty}`).toBe(true);
        expect(solved.acquired).toEqual(expect.arrayContaining([...first.exitRequires]));
        hides.add(
          first.spots
            .filter((spot) => spot.role === 'hide')
            .map((spot) => `${spot.id}:${[...spot.contentIds].join('+')}:${spot.requires.join('+')}`)
            .join('|'),
        );
        count += 1;
      }
    }
    expect(count).toBe(3000);
    expect(codes.size).toBeGreaterThan(100);
    expect(orders.size).toBeGreaterThan(20);
    expect(hides.size).toBeGreaterThan(10);
    expect([...codes].some((code) => code.startsWith('0'))).toBe(true);
  });

  it('utilise le gabarit de secours après 20 candidats refusés', () => {
    let calls = 0;
    const input = { seed: 'secours-1', difficulty: 'standard' as const, version: 1 as const };
    const rescued = generate(input, {
      isCandidateAccepted: () => {
        calls += 1;
        return false;
      },
    });
    const normal = generate(input);
    expect(calls).toBe(20);
    expect(rescued.fallback).toBe(true);
    expect(rescued.layoutId).toBe('perimetre');
    expect(rescued.puzzles).toHaveLength(DIFFICULTIES.standard.puzzles);
    expect(rescued.input).toEqual(input);
    expect(validate(rescued)).toEqual([]);
    expect(solve(rescued).solvable).toBe(true);
    const codeOf = (world: WorldDescription) =>
      world.puzzles.flatMap((puzzle) => (puzzle.family === 'code' ? [puzzle.solution] : []));
    expect(codeOf(rescued)).toEqual(codeOf(normal));
  });
});

describe('frontières pures', () => {
  it('n’importe ni three.js ni Rapier dans domain ou generation', () => {
    for (const root of ['src/domain', 'src/generation']) {
      for (const file of fs.readdirSync(root)) {
        if (!file.endsWith('.ts')) continue;
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        expect(source).not.toMatch(/from ['"]three['"]/);
        expect(source).not.toMatch(/rapier/i);
      }
    }
  });
});
