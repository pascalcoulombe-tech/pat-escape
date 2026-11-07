import type { Difficulty, SeedInput, SeedRead } from './types';

export const PLAYER_RADIUS = 0.3;
export const INTERACT_RANGE = 1.8;
export const MOVE_SPEED = 2;
export const EYE_HEIGHT = 1.55;
export const ROOM_SIZE = 6;
export const HINT_IDLE_MS = 90_000;
export const BACKGROUND_DELTA_MS = 2_000;
export const PITCH_LIMIT = 1.2;

export const DIFFICULTIES = {
  discovery: { puzzles: 4, seconds: 1200, hints: 6, label: 'Découverte' },
  standard: { puzzles: 6, seconds: 900, hints: 3, label: 'Standard' },
  expert: { puzzles: 8, seconds: 600, hints: 1, label: 'Expert' },
} as const satisfies Record<
  Difficulty,
  { puzzles: number; seconds: number; hints: number; label: string }
>;

const SEED_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

export function readSeedInput(raw: {
  seed: string;
  difficulty: string;
  version: number;
}): SeedRead {
  if (raw.version !== 1) {
    return { error: 'Version de graine non prise en charge.' };
  }
  if (!SEED_PATTERN.test(raw.seed)) {
    return {
      error: 'Graine refusée. Utilise de 1 à 64 caractères : lettres, chiffres ou tirets.',
    };
  }
  if (!(raw.difficulty in DIFFICULTIES)) {
    return { error: 'Difficulté inconnue. Choisis Découverte, Standard ou Expert.' };
  }
  return {
    seed: raw.seed,
    difficulty: raw.difficulty as Difficulty,
    version: 1,
  };
}

export function isSeedInput(value: SeedRead): value is SeedInput {
  return !('error' in value);
}
