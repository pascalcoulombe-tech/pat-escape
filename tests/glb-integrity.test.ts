import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAYOUT_IDS, THEME_IDS } from '../src/generation/layouts';
import { assetsForRun } from '../src/runtime/model-url';

type ManifestAsset = {
  id: string;
  file: string;
  bytes: number;
  layoutId?: string;
  geometrySha256: string;
};

type Manifest = {
  themes: Record<string, { assets: ManifestAsset[] }>;
};

type Checksum = { sha256: string; file: string; bytes: number };

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'src/assets/delivery-manifest.json'), 'utf8')) as Manifest;
const checksums = (JSON.parse(readFileSync(resolve(root, 'src/assets/glb-checksums.json'), 'utf8')) as Checksum[]).filter((item) =>
  item.file.endsWith('.glb'),
);

describe('intégrité des GLB livrés', () => {
  it('aligne les 78 fichiers sur le manifeste et les SHA-256 de transfert', () => {
    const assets = Object.entries(manifest.themes).flatMap(([theme, entry]) =>
      entry.assets.map((asset) => ({ theme, ...asset })),
    );
    expect(assets).toHaveLength(78);
    expect(checksums).toHaveLength(78);
    let total = 0;
    for (const asset of assets) {
      const relative = `${asset.theme}/${asset.file}`;
      const bytes = readFileSync(resolve(root, 'public/models', relative));
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const recorded = checksums.find((item) => item.file === relative);
      expect(recorded, relative).toBeTruthy();
      expect(bytes.byteLength).toBe(asset.bytes);
      expect(recorded?.bytes).toBe(asset.bytes);
      expect(sha256).toBe(recorded?.sha256);
      total += bytes.byteLength;
    }
    expect(total).toBe(2_090_432);
  });

  it('fait correspondre chaque couple thème/gabarit à un fichier du manifeste', () => {
    for (const theme of THEME_IDS) {
      const assets = manifest.themes[theme]?.assets ?? [];
      for (const layout of LAYOUT_IDS) {
        for (const request of assetsForRun(theme, layout, '/pat-escape/')) {
          const file = request.url.slice(request.url.lastIndexOf('/') + 1);
          const match = assets.find((asset) => asset.file === file);
          expect(match, `${theme}/${file}`).toBeTruthy();
          if (request.slot === 'room_shell' || request.slot === 'sortie') {
            expect(match?.layoutId).toBeUndefined();
          } else {
            expect(match?.layoutId).toBe(layout);
            expect(match?.id).toBe(request.slot);
          }
        }
      }
    }
  });

  it('garde la même géométrie entre les thèmes', () => {
    const byKey = new Map<string, string[]>();
    for (const [theme, entry] of Object.entries(manifest.themes)) {
      for (const asset of entry.assets) {
        const key = `${asset.id}:${asset.layoutId ?? ''}`;
        const hashes = byKey.get(key) ?? [];
        hashes.push(`${theme}:${asset.geometrySha256}`);
        byKey.set(key, hashes);
      }
    }
    for (const hashes of byKey.values()) {
      const values = hashes.map((item) => item.split(':')[1]);
      expect(new Set(values).size).toBe(1);
    }
  });
});
