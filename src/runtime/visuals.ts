import * as THREE from 'three';

export type GlbLoad = (url: string) => Promise<THREE.Object3D>;

export type VisualSlot = Readonly<{
  slot: string;
  url: string;
  parent: THREE.Object3D;
  proxies: readonly THREE.Mesh[];
}>;

export type VisualSession = Readonly<{
  load(slots: readonly VisualSlot[]): Promise<number>;
  count(): number;
  dispose(): void;
}>;

const TEXTURE_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const;

export function createVisualSession(load: GlbLoad): VisualSession {
  let generation = 0;
  let loaded = 0;
  const attached: THREE.Object3D[] = [];
  const ghosts: THREE.Material[] = [];

  return {
    async load(slots) {
      const token = generation;
      const results = await Promise.all(
        slots.map(async (slot) => {
          try {
            return { slot, root: await load(slot.url) };
          } catch {
            return { slot, root: null };
          }
        }),
      );
      if (token !== generation) {
        for (const result of results) {
          if (result.root) disposeTree(result.root);
        }
        return loaded;
      }
      for (const result of results) {
        if (!result.root) continue;
        silence(result.root);
        result.slot.parent.add(result.root);
        attached.push(result.root);
        for (const proxy of result.slot.proxies) hideProxy(proxy, ghosts);
        loaded += 1;
      }
      return loaded;
    },
    count() {
      return loaded;
    },
    dispose() {
      generation += 1;
      for (const root of attached) disposeTree(root);
      attached.length = 0;
      for (const material of ghosts) material.dispose();
      ghosts.length = 0;
      loaded = 0;
    },
  };
}

function hideProxy(proxy: THREE.Mesh, ghosts: THREE.Material[]): void {
  const source = proxy.material;
  const materials = Array.isArray(source) ? source : [source];
  const hidden = materials.map((material) => {
    const ghost = material.clone();
    ghost.colorWrite = false;
    ghost.depthWrite = false;
    ghosts.push(ghost);
    return ghost;
  });
  proxy.material = Array.isArray(source) ? hidden : (hidden[0] ?? source);
  proxy.visible = true;
}

function silence(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.raycast = () => {};
  });
}

function disposeTree(root: THREE.Object3D): void {
  root.removeFromParent();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const source = mesh.material as THREE.Material | THREE.Material[] | undefined;
    const materials = Array.isArray(source) ? source : source ? [source] : [];
    for (const material of materials) {
      const textured = material as THREE.MeshStandardMaterial;
      for (const key of TEXTURE_KEYS) textured[key]?.dispose();
      material.dispose();
    }
  });
}
