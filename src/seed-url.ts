import { readSeedInput } from './domain/config';
import type { SeedInput, SeedRead } from './domain/types';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function formatSeedUrl(url: URL, input: SeedInput): URL {
  const next = new URL(url.href);
  next.search = '';
  next.searchParams.set('seed', input.seed);
  next.searchParams.set('difficulty', input.difficulty);
  next.searchParams.set('version', String(input.version));
  return next;
}

export function parseSeedUrl(url: URL): SeedRead {
  const versionRaw = url.searchParams.get('version');
  if (versionRaw !== null && versionRaw !== '1') {
    return { error: 'Version de graine non prise en charge.' };
  }
  return readSeedInput({
    seed: url.searchParams.get('seed') ?? '',
    difficulty: url.searchParams.get('difficulty') ?? '',
    version: versionRaw === '1' ? 1 : 0,
  });
}

export function mintSeed(entropy: readonly number[], exclude?: string): string {
  let seed = '';
  for (let index = 0; index < 12; index += 1) {
    const value = Math.abs(entropy[index] ?? index + 1);
    seed += ALPHABET[value % ALPHABET.length] ?? 'a';
  }
  if (seed === exclude) return mintSeed(entropy.map((value) => value + 1), exclude);
  return seed;
}
