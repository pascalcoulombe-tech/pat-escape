import * as THREE from 'three';
import { INTERACT_RANGE } from '../domain/config';
import type { Id, SceneAdapter, ThemeId, WorldDescription } from '../domain/types';
import { wallColliders } from '../generation/layouts';

const THEME_COLORS: Record<ThemeId, { wall: number; floor: number; ceiling: number; wood: number; accent: number; fog: number; light: number }> = {
  cabane: { wall: 0x8d5a3b, floor: 0xc4a574, ceiling: 0x6b4226, wood: 0xa56b3c, accent: 0x4e342e, fog: 0xd7c4a3, light: 1.05 },
  chalet: { wall: 0xd9d3c7, floor: 0x8d6e63, ceiling: 0xefebe9, wood: 0x6d4c41, accent: 0x5d4037, fog: 0xeceff1, light: 1 },
  'sous-sol': { wall: 0x546e7a, floor: 0x37474f, ceiling: 0x263238, wood: 0x455a64, accent: 0x90a4ae, fog: 0x455a64, light: 0.72 },
};

const PICK_ANGLE = 1.05;

export function createScene(canvas: HTMLCanvasElement, description: WorldDescription, mobile: boolean): SceneAdapter {
  const colors = THEME_COLORS[description.theme];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.fog);
  scene.fog = new THREE.Fog(colors.fog, 7, 16);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.08, 40);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: mobile ? 'low-power' : 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !mobile;
  renderer.setPixelRatio(1);

  scene.add(new THREE.AmbientLight(0xfff4e0, mobile ? 0.85 : 0.55));
  if (!mobile) scene.add(new THREE.HemisphereLight(0xfff1d6, 0x6d4c41, 0.45));
  const sun = new THREE.DirectionalLight(0xfff6df, colors.light);
  sun.position.set(3, 4.5, 2);
  if (!mobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
  }
  scene.add(sun);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.Material[] = [];
  const lambert = (color: number) => {
    const material = new THREE.MeshLambertMaterial({ color });
    materials.push(material);
    return material;
  };
  const floorMaterial = lambert(colors.floor);
  const wallMaterial = lambert(colors.wall);
  const woodMaterial = lambert(colors.wood);
  const accentMaterial = lambert(colors.accent);
  const rugMaterial = lambert(description.theme === 'sous-sol' ? 0x5d4037 : 0x8d3b3b);
  const ceilingMaterial = lambert(colors.ceiling);

  const floor = new THREE.Mesh(box, floorMaterial);
  floor.scale.set(6, 0.08, 6);
  floor.position.set(3, -0.04, 3);
  floor.userData = { ignore: true };
  scene.add(floor);
  const ceiling = new THREE.Mesh(box, ceilingMaterial);
  ceiling.scale.set(6, 0.08, 6);
  ceiling.position.set(3, 2.75, 3);
  ceiling.userData = { ignore: true };
  scene.add(ceiling);

  const geometries: THREE.BufferGeometry[] = [box];
  const occluders: THREE.Object3D[] = [];
  for (const wall of wallColliders(true)) {
    occluders.push(addBox(scene, box, wallMaterial, wall, { blocks: true }));
  }
  let door: THREE.Mesh | null = null;
  for (const module of description.modules) {
    const material = module.kind === 'tapis' ? rugMaterial : module.kind === 'tableau' || module.kind === 'leviers' ? accentMaterial : woodMaterial;
    const mesh = addBox(scene, box, material, module.collision, { id: module.id, blocks: module.blocksMovement });
    if (!mobile) mesh.castShadow = module.blocksMovement;
    mesh.receiveShadow = !mobile;
    occluders.push(mesh);
  }
  door = addBox(scene, box, accentMaterial, description.exit.collision, { id: description.exit.id, blocks: true });
  occluders.push(door);
  addLynx(scene, materials, geometries);

  const targets = [
    ...description.spots.map((spot) => ({ id: spot.id, point: spot.interaction })),
    { id: description.exit.id, point: description.exit.interaction },
  ];
  const raycaster = new THREE.Raycaster();
  let pixelRatio = 1;
  let width = 0;
  let height = 0;

  const applySize = () => {
    const nextWidth = Math.max(1, canvas.clientWidth);
    const nextHeight = Math.max(1, canvas.clientHeight);
    if (nextWidth === width && nextHeight === height) {
      renderer.setPixelRatio(pixelRatio);
      return;
    }
    width = nextWidth;
    height = nextHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
  };

  const direction = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const to = new THREE.Vector3();

  return {
    render(pose, game) {
      applySize();
      eye.set(pose.position.x, pose.position.y, pose.position.z);
      direction.set(
        Math.sin(pose.yaw) * Math.cos(pose.pitch),
        Math.sin(pose.pitch),
        Math.cos(pose.yaw) * Math.cos(pose.pitch),
      );
      camera.position.copy(eye);
      camera.lookAt(eye.x + direction.x, eye.y + direction.y, eye.z + direction.z);
      if (door) {
        const open = game.exitOpened;
        door.position.x = open ? 1.05 : (description.exit.collision.min.x + description.exit.collision.max.x) / 2;
        door.userData.blocks = !open;
      }
      renderer.render(scene, camera);
    },
    pick(pose) {
      eye.set(pose.position.x, pose.position.y, pose.position.z);
      direction.set(
        Math.sin(pose.yaw) * Math.cos(pose.pitch),
        Math.sin(pose.pitch),
        Math.cos(pose.yaw) * Math.cos(pose.pitch),
      );
      const candidates: { id: Id; angle: number; distance: number }[] = [];
      for (const target of targets) {
        to.set(target.point.x, target.point.y, target.point.z);
        const offset = to.clone().sub(eye);
        const distance = offset.length();
        if (distance > INTERACT_RANGE || distance < 0.001) continue;
        const angle = direction.angleTo(offset);
        if (angle > PICK_ANGLE) continue;
        if (blocked(raycaster, occluders, eye, offset, distance, target.id)) continue;
        candidates.push({ id: target.id, angle, distance });
      }
      const focused = candidates.filter((candidate) => candidate.id !== 'tapis' && candidate.angle < 0.5);
      const pool = focused.length > 0 ? focused : candidates;
      let best: { id: Id; score: number } | null = null;
      for (const candidate of pool) {
        const score = candidate.angle * 4 + candidate.distance * 0.04;
        if (!best || score < best.score) best = { id: candidate.id, score };
      }
      return best?.id ?? null;
    },
    setPixelRatio(ratio) {
      pixelRatio = Math.max(0.65, Math.min(2, ratio));
      width = 0;
      applySize();
    },
    dispose() {
      renderer.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

function addBox(
  scene: THREE.Scene,
  geometry: THREE.BoxGeometry,
  material: THREE.Material,
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
  data: { id?: string; blocks?: boolean; ignore?: boolean },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(
    Math.max(0.04, box.max.x - box.min.x),
    Math.max(0.04, box.max.y - box.min.y),
    Math.max(0.04, box.max.z - box.min.z),
  );
  mesh.position.set(
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  );
  mesh.userData = data;
  scene.add(mesh);
  return mesh;
}

function addLynx(scene: THREE.Scene, materials: THREE.Material[], geometries: THREE.BufferGeometry[]) {
  const fur = new THREE.MeshLambertMaterial({ color: 0xc4a15a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4a3428 });
  materials.push(fur, dark);
  const group = new THREE.Group();
  const bodyGeometry = new THREE.SphereGeometry(0.18, 10, 8);
  const headGeometry = new THREE.SphereGeometry(0.12, 10, 8);
  const earGeometry = new THREE.ConeGeometry(0.05, 0.14, 6);
  geometries.push(bodyGeometry, headGeometry, earGeometry);
  const body = new THREE.Mesh(bodyGeometry, fur);
  body.scale.set(1, 0.8, 1.3);
  body.position.y = 0.28;
  const head = new THREE.Mesh(headGeometry, fur);
  head.position.set(0, 0.48, 0.16);
  const leftEar = new THREE.Mesh(earGeometry, dark);
  leftEar.position.set(-0.06, 0.62, 0.14);
  const rightEar = new THREE.Mesh(earGeometry, dark);
  rightEar.position.set(0.06, 0.62, 0.14);
  group.add(body, head, leftEar, rightEar);
  group.position.set(3, 0, 0.42);
  group.userData = { ignore: true };
  scene.add(group);
}

function blocked(
  raycaster: THREE.Raycaster,
  occluders: THREE.Object3D[],
  origin: THREE.Vector3,
  offset: THREE.Vector3,
  distance: number,
  targetId: string,
): boolean {
  const direction = offset.clone().normalize();
  raycaster.set(origin, direction);
  raycaster.far = distance;
  const hits = raycaster.intersectObjects(occluders, false);
  for (const hit of hits) {
    if (hit.object.userData.ignore) continue;
    if (hit.object.userData.id === targetId) return false;
    if (hit.object.userData.blocks && hit.distance < distance - 0.12) return true;
  }
  return false;
}
