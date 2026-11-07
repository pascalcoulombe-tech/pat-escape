import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createVisualSession, type GlbLoad } from '../src/runtime/visuals';

function model(): { root: THREE.Group; disposed: () => number } {
  let disposed = 0;
  const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const material = new THREE.MeshBasicMaterial();
  const texture = new THREE.Texture();
  material.map = texture;
  const disposeGeometry = geometry.dispose.bind(geometry);
  const disposeMaterial = material.dispose.bind(material);
  const disposeTexture = texture.dispose.bind(texture);
  geometry.dispose = () => {
    disposed += 1;
    disposeGeometry();
  };
  material.dispose = () => {
    disposed += 1;
    disposeMaterial();
  };
  texture.dispose = () => {
    disposed += 1;
    disposeTexture();
  };
  const mesh = new THREE.Mesh(geometry, material);
  const root = new THREE.Group();
  root.add(mesh);
  return { root, disposed: () => disposed };
}

function slot(url: string) {
  const parent = new THREE.Group();
  const shared = new THREE.MeshLambertMaterial({ color: 0xff0000 });
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  parent.add(proxy);
  return { slot: url, url, parent, proxies: [proxy], shared };
}

describe('chargement visuel', () => {
  it('garde le proxy sélectionnable et masque seulement son dessin', async () => {
    const made = model();
    const session = createVisualSession(async () => made.root);
    const target = slot('/pat-escape/models/cabane/door.glb');
    await session.load([target]);
    expect(session.count()).toBe(1);
    expect(target.parent.children).toContain(made.root);
    expect(target.proxies[0]?.visible).toBe(true);
    expect((target.proxies[0]?.material as THREE.Material).colorWrite).toBe(false);
    expect((target.proxies[0]?.material as THREE.Material).depthWrite).toBe(false);
    expect(target.shared.colorWrite).toBe(true);
    target.parent.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(made.root, true)).toHaveLength(0);
  });

  it('retombe sur le proxy du slot qui échoue et compte les autres', async () => {
    const session = createVisualSession(async (url) => {
      if (url.includes('tapis')) throw new Error('introuvable');
      return model().root;
    });
    const slots = ['room_shell', 'sortie', 'tapis'].map((name) => slot(`/models/${name}.glb`));
    await session.load(slots);
    expect(session.count()).toBe(2);
    const failed = slots[2];
    expect((failed?.proxies[0]?.material as THREE.Material).colorWrite).toBe(true);
    expect(failed?.parent.children).toHaveLength(1);
  });

  it('n’attache pas une réponse tardive et libère ses ressources', async () => {
    let release: (root: THREE.Object3D) => void = () => {};
    const pending = new Promise<THREE.Object3D>((resolve) => {
      release = resolve;
    });
    const load: GlbLoad = () => pending;
    const session = createVisualSession(load);
    const target = slot('/models/cabane/room_shell.glb');
    const loading = session.load([target]);
    session.dispose();
    const made = model();
    release(made.root);
    await loading;
    expect(session.count()).toBe(0);
    expect(target.parent.children).toEqual([target.proxies[0]]);
    expect(made.disposed()).toBe(3);
  });

  it('vide les modèles déjà posés au dispose', async () => {
    const made = model();
    const session = createVisualSession(async () => made.root);
    const target = slot('/models/cabane/commode_fer.glb');
    await session.load([target]);
    session.dispose();
    expect(session.count()).toBe(0);
    expect(target.parent.children).toEqual([target.proxies[0]]);
    expect(made.disposed()).toBe(3);
  });
});
