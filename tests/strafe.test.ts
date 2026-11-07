import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { InputFrame } from '../src/domain/types';
import { movementFromKeys } from '../src/input/desktop';
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
  return { forward, right };
}

async function travel(input: InputFrame, yaw: number) {
  const description = generate({ seed: 'strafe-1', difficulty: 'discovery', version: 1 });
  const physics = await createPhysics(description);
  physics.step({ moveX: 0, moveZ: 0, lookX: -yaw, lookY: 0, interact: false }, 1 / 60);
  const start = physics.getPose();
  for (let step = 0; step < 20; step += 1) physics.step(input, 1 / 60);
  const next = physics.getPose();
  physics.dispose();
  const delta = new THREE.Vector3(next.position.x - start.position.x, 0, next.position.z - start.position.z);
  const basis = cameraBasis(start.yaw, start.pitch);
  return {
    yaw: start.yaw,
    distance: delta.length(),
    screenRight: delta.dot(basis.right),
    screenForward: delta.dot(basis.forward),
  };
}

function keyFrame(code: string): InputFrame {
  const move = movementFromKeys(new Set([code]));
  return { moveX: move.moveX, moveZ: move.moveZ, lookX: 0, lookY: 0, interact: false };
}

const stickRight = frameFromPointers(
  [
    {
      id: 1,
      x: 120,
      y: 200,
      startX: 40,
      startY: 200,
      lastX: 40,
      lastY: 200,
      zone: 'move',
    },
  ],
  1,
);

describe('marche relative à l’écran', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -1.2]) {
    it(`envoie D, la flèche droite et le joystick vers la droite de l’écran à ${yaw.toFixed(2)}`, async () => {
      for (const input of [keyFrame('KeyD'), keyFrame('ArrowRight'), stickRight]) {
        const moved = await travel(input, yaw);
        expect(moved.distance).toBeGreaterThan(0.25);
        expect(moved.screenRight).toBeGreaterThan(0.2);
      }
    });

    it(`envoie A, Q et la flèche gauche vers la gauche de l’écran à ${yaw.toFixed(2)}`, async () => {
      for (const input of [keyFrame('KeyA'), keyFrame('KeyQ'), keyFrame('ArrowLeft')]) {
        const moved = await travel(input, yaw);
        expect(moved.distance).toBeGreaterThan(0.25);
        expect(moved.screenRight).toBeLessThan(-0.2);
      }
    });

    it(`avance avec W et recule avec S à ${yaw.toFixed(2)}`, async () => {
      const forward = await travel(keyFrame('KeyW'), yaw);
      const back = await travel(keyFrame('KeyS'), yaw);
      expect(forward.screenForward).toBeGreaterThan(0.2);
      expect(back.screenForward).toBeLessThan(-0.2);
    });
  }
});
