import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, readSeedInput } from '../src/domain/config';
import { createRng, rngFor } from '../src/generation/random';

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
