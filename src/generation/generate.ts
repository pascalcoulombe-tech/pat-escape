import { DIFFICULTIES, readSeedInput } from '../domain/config';
import type { Difficulty, Family, Id, Puzzle, SeedInput, ThemeId, Token, WorldDescription } from '../domain/types';
import { buildLayout, LAYOUT_IDS, THEME_IDS } from './layouts';
import { rngFor, rngInt, shuffle } from './random';
import { validate } from './validate';

export type GenerateOptions = Readonly<{
  isCandidateAccepted?: (world: WorldDescription, attempt: number) => boolean;
}>;

type Named = Readonly<{ key: string; label: string; symbol: string; color: string }>;

type Drawn = Readonly<{
  theme: ThemeId;
  layoutSlot: number;
  families: readonly Family[];
  codes: readonly string[];
  symbols: readonly (readonly Named[])[];
  orders: readonly (readonly Named[])[];
  recipes: readonly { left: Named; right: Named }[];
  rolls: readonly number[];
}>;

const SYMBOLS: readonly Named[] = [
  { key: 'cercle', label: 'Cercle', symbol: 'cercle', color: 'rouge' },
  { key: 'carre', label: 'Carré', symbol: 'carre', color: 'bleu' },
  { key: 'triangle', label: 'Triangle', symbol: 'triangle', color: 'vert' },
  { key: 'etoile', label: 'Étoile', symbol: 'etoile', color: 'jaune' },
  { key: 'lune', label: 'Lune', symbol: 'lune', color: 'violet' },
  { key: 'soleil', label: 'Soleil', symbol: 'soleil', color: 'ocre' },
  { key: 'cle', label: 'Clé', symbol: 'cle', color: 'gris' },
  { key: 'feuille', label: 'Feuille', symbol: 'feuille', color: 'vert' },
];

const MECHANISMS: readonly Named[] = [
  { key: 'levier', label: 'Levier', symbol: 'levier', color: 'rouge' },
  { key: 'manivelle', label: 'Manivelle', symbol: 'manivelle', color: 'bleu' },
  { key: 'bouton', label: 'Bouton', symbol: 'bouton', color: 'vert' },
  { key: 'pedale', label: 'Pédale', symbol: 'pedale', color: 'jaune' },
];

const RECIPES: readonly { left: Named; right: Named }[] = [
  {
    left: { key: 'ficelle', label: 'Ficelle', symbol: 'corde', color: 'brun' },
    right: { key: 'crochet', label: 'Crochet', symbol: 'crochet', color: 'gris' },
  },
  {
    left: { key: 'pile', label: 'Pile', symbol: 'pile', color: 'bleu' },
    right: { key: 'ampoule', label: 'Ampoule', symbol: 'ampoule', color: 'jaune' },
  },
  {
    left: { key: 'cle-plate', label: 'Clé plate', symbol: 'cle', color: 'gris' },
    right: { key: 'anneau', label: 'Anneau', symbol: 'anneau', color: 'or' },
  },
  {
    left: { key: 'huile', label: 'Huile', symbol: 'fiole', color: 'jaune' },
    right: { key: 'chiffon', label: 'Chiffon', symbol: 'chiffon', color: 'ocre' },
  },
];

const STATION: Record<Family, Id> = {
  code: 'pupitre',
  symbols: 'tableau',
  order: 'leviers',
  combine: 'table',
};

const KEY_COLORS = ['rouge', 'bleu', 'vert', 'jaune', 'violet', 'ocre', 'gris', 'or'] as const;

function familiesFor(difficulty: Difficulty): Family[] {
  const extras: Record<Difficulty, readonly Family[]> = {
    discovery: [],
    standard: ['code', 'order'],
    expert: ['code', 'symbols', 'order', 'combine'],
  };
  return ['code', 'symbols', 'order', 'combine', ...extras[difficulty]];
}

function draw(input: SeedInput): Drawn {
  const rng = rngFor(input, 0);
  const families = familiesFor(input.difficulty);
  const theme = THEME_IDS[rngInt(rng, THEME_IDS.length)] ?? 'cabane';
  const layoutSlot = rngInt(rng, LAYOUT_IDS.length);
  const codes = families
    .filter((family) => family === 'code')
    .map(() => rngInt(rng, 1000).toString().padStart(3, '0'));
  const symbolDeck = shuffle(rng, SYMBOLS);
  const symbols: Named[][] = [];
  let symbolCursor = 0;
  for (let count = families.filter((family) => family === 'symbols').length; count > 0; count -= 1) {
    symbols.push(shuffle(rng, symbolDeck.slice(symbolCursor, symbolCursor + 3)));
    symbolCursor += 3;
  }
  const orders = families
    .filter((family) => family === 'order')
    .map(() => shuffle(rng, MECHANISMS).slice(0, rng() < 0.5 ? 3 : 4));
  const recipes = shuffle(rng, RECIPES).slice(
    0,
    families.filter((family) => family === 'combine').length,
  );
  const rolls = Array.from({ length: 24 }, () => rngInt(rng, 997));
  return { theme, layoutSlot, families, codes, symbols, orders, recipes, rolls };
}

function rewardIndex(id: string): number | null {
  const match = /^recompense-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

type MutableSpot = {
  id: Id;
  moduleId: Id;
  label: string;
  role: WorldDescription['spots'][number]['role'];
  family: Family | null;
  contentIds: Id[];
  requires: Id[];
  collision: WorldDescription['spots'][number]['collision'];
  interaction: WorldDescription['spots'][number]['interaction'];
};

function assemble(input: SeedInput, drawn: Drawn, attempt: number, fallback: boolean): WorldDescription {
  const layoutId = fallback ? 'perimetre' : (LAYOUT_IDS[(drawn.layoutSlot + attempt) % LAYOUT_IDS.length] ?? 'perimetre');
  const layout = buildLayout(layoutId, drawn.theme);
  const spots: MutableSpot[] = layout.spots.map((spot) => ({
    ...spot,
    contentIds: [],
    requires: [],
  }));
  const hides = spots.filter((spot) => spot.role === 'hide');
  const consumed = new Set<Id>();
  drawn.families.forEach((family, index) => {
    if (family === 'combine' && index > 0) consumed.add(`recompense-${index - 1}`);
  });
  const last = drawn.families.length - 1;
  const safeGates = drawn.families
    .map((_, index) => `recompense-${index}`)
    .filter((id, index) => index !== last && !consumed.has(id));
  const gateA = safeGates[0];
  const gateB = safeGates[Math.min(2, Math.max(0, safeGates.length - 1))];
  if (hides[2] && gateA) hides[2].requires = [gateA];
  if (hides[3] && gateB && gateB !== gateA) hides[3].requires = [gateB];

  const tokens: Token[] = [];
  const puzzles: Puzzle[] = [];
  let codeIndex = 0;
  let symbolIndex = 0;
  let orderIndex = 0;
  let recipeIndex = 0;

  const place = (spot: MutableSpot, id: Id) => {
    spot.contentIds = [...spot.contentIds, id];
  };
  const openHides = () => hides.filter((spot) => spot.requires.length === 0);
  const eligible = (index: number) =>
    hides.filter((spot) =>
      spot.requires.every((need) => {
        const produced = rewardIndex(need);
        return produced !== null && produced < index;
      }),
    );

  drawn.families.forEach((family, index) => {
    const clueId = `indice-${index}`;
    const rewardId = `recompense-${index}`;
    const previous = index === 0 ? null : `recompense-${index - 1}`;
    const choices = eligible(index);
    const hide = choices[(drawn.rolls[index] ?? 0) % Math.max(1, choices.length)] ?? hides[0];
    let puzzle: Puzzle;
    if (family === 'code') {
      const solution = drawn.codes[codeIndex] ?? '000';
      codeIndex += 1;
      tokens.push({
        id: clueId,
        label: `Le cadenas indique ${solution}.`,
        symbol: 'note',
        color: 'ocre',
      });
      puzzle = {
        id: `puzzle-code-${index}`,
        family,
        solution,
        requires: previous ? [previous] : [],
        clueIds: [clueId],
        rewardIds: [rewardId],
        stationId: STATION.code,
      };
    } else if (family === 'symbols') {
      const group = drawn.symbols[symbolIndex] ?? [];
      symbolIndex += 1;
      const solution = group.map((entry) => {
        const id = `symbole-${index}-${entry.key}`;
        tokens.push({ id, label: entry.label, symbol: entry.symbol, color: entry.color });
        return id;
      });
      tokens.push({
        id: clueId,
        label: `Reproduis les symboles dans cet ordre : ${group
          .map((entry) => `${entry.label} ${entry.color}, forme ${entry.symbol}`)
          .join(', puis ')}.`,
        symbol: 'note',
        color: 'ocre',
      });
      puzzle = {
        id: `puzzle-symbols-${index}`,
        family,
        solution,
        requires: previous ? [previous] : [],
        clueIds: [clueId],
        rewardIds: [rewardId],
        stationId: STATION.symbols,
      };
    } else if (family === 'order') {
      const group = drawn.orders[orderIndex] ?? [];
      orderIndex += 1;
      const solution = group.map((entry) => {
        const id = `ordre-${index}-${entry.key}`;
        tokens.push({ id, label: entry.label, symbol: entry.symbol, color: entry.color });
        return id;
      });
      tokens.push({
        id: clueId,
        label: `Actionne dans cet ordre : ${group.map((entry) => entry.label.toLowerCase()).join(', puis ')}.`,
        symbol: 'note',
        color: 'ocre',
      });
      puzzle = {
        id: `puzzle-order-${index}`,
        family,
        solution,
        requires: previous ? [previous] : [],
        clueIds: [clueId],
        rewardIds: [rewardId],
        stationId: STATION.order,
      };
    } else {
      const recipe = drawn.recipes[recipeIndex] ?? RECIPES[0];
      recipeIndex += 1;
      const leftId = `objet-${index}-a`;
      const rightId = previous ?? `objet-${index}-b`;
      if (!recipe) throw new Error('Recette manquante.');
      tokens.push({
        id: leftId,
        label: recipe.left.label,
        symbol: recipe.left.symbol,
        color: recipe.left.color,
      });
      if (!previous) {
        tokens.push({
          id: rightId,
          label: recipe.right.label,
          symbol: recipe.right.symbol,
          color: recipe.right.color,
        });
      }
      const opens = openHides();
      const bucket = opens[(drawn.rolls[8 + index] ?? 0) % Math.max(1, opens.length)] ?? hides[0];
      if (bucket) place(bucket, leftId);
      if (!previous && bucket) place(bucket, rightId);
      const partner = previous
        ? drawn.families[index - 1] === 'combine'
          ? `assemblage ${index}`
          : `clé ${KEY_COLORS[index - 1] ?? 'or'}`
        : recipe.right.label;
      tokens.push({
        id: clueId,
        label: `Assemble ${recipe.left.label.toLowerCase()} avec ${partner.toLowerCase()}.`,
        symbol: 'note',
        color: 'ocre',
      });
      const ingredients: readonly [Id, Id] = [leftId, rightId];
      puzzle = {
        id: `puzzle-combine-${index}`,
        family,
        ingredients,
        resultId: rewardId,
        requires: [],
        clueIds: [clueId],
        rewardIds: [rewardId],
        stationId: STATION.combine,
      };
    }
    if (hide) place(hide, clueId);
    const color = KEY_COLORS[index] ?? 'or';
    tokens.push(
      index === last
        ? { id: rewardId, label: 'Clé de sortie', symbol: 'cle', color: 'or' }
        : family === 'combine'
          ? { id: rewardId, label: `Assemblage ${index + 1}`, symbol: 'noeud', color: 'brun' }
          : { id: rewardId, label: `Clé ${color}`, symbol: 'cle', color },
    );
    puzzles.push(puzzle);
  });

  const initialIds = spots
    .filter((spot) => spot.requires.length === 0)
    .flatMap((spot) => spot.contentIds)
    .sort();

  return {
    input,
    theme: drawn.theme,
    layoutId,
    spawn: layout.spawn,
    exit: layout.exit,
    modules: layout.modules,
    spots,
    tokens,
    puzzles,
    initialIds,
    exitRequires: [`recompense-${last}`],
    fallback,
  };
}

export function generate(raw: SeedInput, options?: GenerateOptions): WorldDescription {
  const parsed = readSeedInput(raw);
  if ('error' in parsed) throw new Error(parsed.error);
  const drawn = draw(parsed);
  if (drawn.families.length !== DIFFICULTIES[parsed.difficulty].puzzles) {
    throw new Error("Nombre d'énigmes incorrect.");
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const world = assemble(parsed, drawn, attempt, false);
    const accepted = options?.isCandidateAccepted
      ? options.isCandidateAccepted(world, attempt)
      : validate(world).length === 0;
    if (accepted) return world;
  }
  return assemble(parsed, drawn, 0, true);
}
