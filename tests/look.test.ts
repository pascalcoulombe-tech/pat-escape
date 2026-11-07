import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lookFromPointer } from '../src/input/desktop';
import { frameFromPointers } from '../src/input/touch';
import { generate } from '../src/generation/generate';
import { lookDirection } from '../src/runtime/scene';
import { createPhysics } from '../src/runtime/physics';

function cameraBasis(yaw: number, pitch: number) {
  const camera = new THREE.PerspectiveCamera();
  const eye = new THREE.Vector3(0, 1.55, 0);
  const direction = lookDirection(yaw, pitch);
  camera.position.copy(eye);
  camera.up.set(0, 1, 0);
  camera.lookAt(eye.x + direction.x, eye.y + direction.y, eye.z + direction.z);
  camera.updateMatrixWorld(true);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  return { forward, right, up };
}

async function turn(lookX: number, lookY: number) {
  const description = generate({ seed: 'regard-1', difficulty: 'discovery', version: 1 });
  const physics = await createPhysics(description);
  const start = physics.getPose();
  const startBasis = cameraBasis(start.yaw, start.pitch);
  physics.step({ moveX: 0, moveZ: 0, lookX, lookY, interact: false }, 1 / 60);
  const next = physics.getPose();
  const nextBasis = cameraBasis(next.yaw, next.pitch);
  physics.dispose();
  return { startBasis, nextBasis };
}

describe('direction du regard', () => {
  it('tourne la caméra vers la droite de l’écran quand la souris va à droite', async () => {
    const { lookX, lookY } = lookFromPointer(120, 0, 1);
    const { startBasis, nextBasis } = await turn(lookX, lookY);
    expect(nextBasis.forward.dot(startBasis.right)).toBeGreaterThan(0.05);
  });

  it('tourne la caméra vers la gauche de l’écran quand la souris va à gauche', async () => {
    const { lookX } = lookFromPointer(-120, 0, 1);
    const { startBasis, nextBasis } = await turn(lookX, 0);
    expect(nextBasis.forward.dot(startBasis.right)).toBeLessThan(-0.05);
  });

  it('abaisse le regard quand la souris descend', async () => {
    const { lookY } = lookFromPointer(0, 90, 1);
    const { startBasis, nextBasis } = await turn(0, lookY);
    expect(nextBasis.forward.dot(startBasis.up)).toBeLessThan(-0.05);
  });

  it('regarde à droite quand le doigt glisse vers la droite', async () => {
    const frame = frameFromPointers(
      [
        {
          id: 2,
          x: 160,
          y: 80,
          startX: 40,
          startY: 80,
          lastX: 40,
          lastY: 80,
          zone: 'look',
        },
      ],
      1,
    );
    const { startBasis, nextBasis } = await turn(frame.lookX, frame.lookY);
    expect(nextBasis.forward.dot(startBasis.right)).toBeGreaterThan(0.05);
  });
});
