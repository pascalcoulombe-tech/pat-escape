export type Difficulty = 'discovery' | 'standard' | 'expert';
export type Family = 'code' | 'symbols' | 'order' | 'combine';
export type Id = string;

export type SeedInput = Readonly<{
  seed: string;
  difficulty: Difficulty;
  version: 1;
}>;

export type Token = Readonly<{
  id: Id;
  label: string;
  symbol: string;
  color: string;
}>;

export type Vec3 = Readonly<{ x: number; y: number; z: number }>;

export type Aabb = Readonly<{ min: Vec3; max: Vec3 }>;

export type ThemeId = 'cabane' | 'chalet' | 'sous-sol';
export type LayoutId = 'perimetre' | 'couloir' | 'fer';

export type ModuleKind =
  | 'commode'
  | 'coffre'
  | 'etagere'
  | 'tapis'
  | 'pupitre'
  | 'tableau'
  | 'leviers'
  | 'table';

export type Module = Readonly<{
  id: Id;
  label: string;
  kind: ModuleKind;
  collision: Aabb;
  interaction: Vec3;
  blocksMovement: boolean;
}>;

export type SpotRole = 'hide' | 'station' | 'exit';

export type Spot = Readonly<{
  id: Id;
  moduleId: Id;
  label: string;
  role: SpotRole;
  family: Family | null;
  contentIds: readonly Id[];
  requires: readonly Id[];
  collision: Aabb;
  interaction: Vec3;
}>;

type PuzzleBase = Readonly<{
  id: Id;
  requires: readonly Id[];
  clueIds: readonly Id[];
  rewardIds: readonly Id[];
  stationId: Id;
}>;

export type CodePuzzle = PuzzleBase & Readonly<{ family: 'code'; solution: string }>;
export type SymbolsPuzzle = PuzzleBase & Readonly<{ family: 'symbols'; solution: readonly Id[] }>;
export type OrderPuzzle = PuzzleBase & Readonly<{ family: 'order'; solution: readonly Id[] }>;
export type CombinePuzzle = PuzzleBase &
  Readonly<{ family: 'combine'; ingredients: readonly [Id, Id]; resultId: Id }>;

export type Puzzle = CodePuzzle | SymbolsPuzzle | OrderPuzzle | CombinePuzzle;

export type ExitDoor = Readonly<{
  id: Id;
  label: string;
  interaction: Vec3;
  collision: Aabb;
}>;

export type WorldDescription = Readonly<{
  input: SeedInput;
  theme: ThemeId;
  layoutId: LayoutId;
  spawn: Vec3;
  exit: ExitDoor;
  modules: readonly Module[];
  spots: readonly Spot[];
  tokens: readonly Token[];
  puzzles: readonly Puzzle[];
  initialIds: readonly Id[];
  exitRequires: readonly Id[];
  fallback: boolean;
}>;

export type ValidationIssue = Readonly<{
  kind: 'logic' | 'spatial';
  id: Id;
  reason: string;
}>;

export type SolveResult = Readonly<{
  solvable: boolean;
  acquired: readonly Id[];
  trace: readonly Id[];
}>;

export type GameState = Readonly<{
  discoveredIds: readonly Id[];
  inventoryIds: readonly Id[];
  consumedIds: readonly Id[];
  solvedIds: readonly Id[];
  journalIds: readonly Id[];
  exitOpened: boolean;
}>;

export type Answer =
  | Readonly<{ family: 'code'; value: string }>
  | Readonly<{ family: 'symbols'; value: readonly Id[] }>
  | Readonly<{ family: 'order'; value: readonly Id[] }>
  | Readonly<{ family: 'combine'; value: readonly [Id, Id] }>;

export type GameAction =
  | Readonly<{ type: 'discover'; spotId: Id }>
  | Readonly<{ type: 'take'; spotId: Id; itemId: Id }>
  | Readonly<{ type: 'submit'; puzzleId: Id; answer: Answer }>
  | Readonly<{ type: 'openExit' }>;

export type Transition = Readonly<{
  state: GameState;
  progressed: boolean;
  message: string;
}>;

export type SessionPhase = 'intro' | 'running' | 'paused' | 'expired' | 'training' | 'won';

export type SessionState = Readonly<{
  phase: SessionPhase;
  activeMs: number;
  remainingMs: number;
  sinceProgressMs: number;
  outOfTime: boolean;
  hintsUsed: number;
  hintBudget: number;
  hintLevels: Readonly<Record<Id, number>>;
}>;

export type SessionAction =
  | Readonly<{ type: 'start' }>
  | Readonly<{ type: 'pause' }>
  | Readonly<{ type: 'resume' }>
  | Readonly<{ type: 'tick'; deltaMs: number }>
  | Readonly<{ type: 'progress' }>
  | Readonly<{ type: 'continueTraining' }>
  | Readonly<{ type: 'win' }>
  | Readonly<{ type: 'hintUsed'; puzzleId: Id }>;

export type HintChoice = Readonly<{
  puzzleId: Id;
  level: number;
  text: string;
}>;

export type InputFrame = Readonly<{
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  interact: boolean;
}>;

export type Pose = Readonly<{
  position: Vec3;
  yaw: number;
  pitch: number;
}>;

export type PhysicsAdapter = Readonly<{
  step(input: InputFrame, deltaSeconds: number): void;
  setDoorOpen(open: boolean): void;
  dispose(): void;
  getPose(): Pose;
}>;

export type SceneAdapter = Readonly<{
  render(pose: Pose, game: GameState): void;
  pick(pose: Pose): Id | null;
  setPixelRatio(ratio: number): void;
  visualCount(): number;
  doorX(): number;
  dispose(): void;
}>;

export type QualityMode = 'auto' | 'manual';

export type QualityState = Readonly<{
  ratio: number;
  slowMs: number;
  fastMs: number;
  mode: QualityMode;
}>;

export type SeedRead = SeedInput | Readonly<{ error: string }>;
