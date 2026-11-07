import { describe, expect, it } from 'vitest';
import { LAYOUT_IDS, THEME_IDS } from '../src/generation/layouts';
import { assetsForRun, modelUrl } from '../src/runtime/model-url';

describe('adresses des modèles', () => {
  it('préfixe la base et évite le double slash', () => {
    expect(modelUrl('/pat-escape/', 'cabane', 'door.glb')).toBe('/pat-escape/models/cabane/door.glb');
    expect(modelUrl('/pat-escape', 'chalet', 'room_shell.glb')).toBe('/pat-escape/models/chalet/room_shell.glb');
  });

  it('demande exactement dix fichiers pour un thème et un gabarit', () => {
    const assets = assetsForRun('cabane', 'couloir', '/pat-escape/');
    expect(assets).toHaveLength(10);
    expect(assets.map((asset) => asset.slot)).toEqual([
      'room_shell',
      'sortie',
      'commode',
      'coffre',
      'etagere',
      'tapis',
      'pupitre',
      'tableau',
      'leviers',
      'table',
    ]);
    expect(assets.find((asset) => asset.slot === 'sortie')?.url).toBe('/pat-escape/models/cabane/door.glb');
    expect(assets.find((asset) => asset.slot === 'commode')?.url).toBe('/pat-escape/models/cabane/commode_couloir.glb');
    expect(assets.find((asset) => asset.slot === 'commode')?.url).not.toBe(
      assetsForRun('cabane', 'perimetre', '/pat-escape/').find((asset) => asset.slot === 'commode')?.url,
    );
  });

  it('couvre les trois thèmes et les trois gabarits sans répéter un couple', () => {
    const keys = THEME_IDS.flatMap((theme) =>
      LAYOUT_IDS.map((layout) => assetsForRun(theme, layout, '/pat-escape/').map((asset) => asset.url).join('|')),
    );
    expect(keys).toHaveLength(9);
    expect(new Set(keys).size).toBe(9);
    for (const theme of THEME_IDS) {
      for (const layout of LAYOUT_IDS) {
        const assets = assetsForRun(theme, layout, '/pat-escape/');
        expect(assets.every((asset) => asset.url.startsWith(`/pat-escape/models/${theme}/`))).toBe(true);
        expect(assets.filter((asset) => asset.url.endsWith(`_${layout}.glb`))).toHaveLength(8);
      }
    }
  });
});
