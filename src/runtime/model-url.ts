import type { LayoutId, ModuleKind, ThemeId } from '../domain/types';

export const MODULE_FILES = [
  'commode',
  'coffre',
  'etagere',
  'tapis',
  'pupitre',
  'tableau',
  'leviers',
  'table',
] as const satisfies readonly ModuleKind[];

export type ModelRequest = Readonly<{
  slot: string;
  url: string;
}>;

export function modelUrl(base: string, theme: string, file: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}models/${theme}/${file}`;
}

export function assetsForRun(theme: ThemeId, layoutId: LayoutId, base: string): readonly ModelRequest[] {
  return [
    { slot: 'room_shell', url: modelUrl(base, theme, 'room_shell.glb') },
    { slot: 'sortie', url: modelUrl(base, theme, 'door.glb') },
    ...MODULE_FILES.map((kind) => ({
      slot: kind,
      url: modelUrl(base, theme, `${kind}_${layoutId}.glb`),
    })),
  ];
}
