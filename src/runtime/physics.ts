import RAPIER from '@dimforge/rapier3d-compat';
import { EYE_HEIGHT, MOVE_SPEED, PITCH_LIMIT, PLAYER_RADIUS } from '../domain/config';
import type { InputFrame, PhysicsAdapter, Pose, WorldDescription } from '../domain/types';
import { wallColliders } from '../generation/layouts';

const FIXED_DT = 1 / 60;
const MAX_STEPS = 120;
const CAPSULE_HALF = 0.45;

let ready: Promise<void> | null = null;

function ensureRapier(): Promise<void> {
  ready ??= RAPIER.init();
  return ready;
}

export async function createPhysics(description: WorldDescription): Promise<PhysicsAdapter> {
  await ensureRapier();
  const rapierWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  rapierWorld.createCollider(RAPIER.ColliderDesc.cuboid(8, 0.2, 8).setTranslation(3, -0.2, 3));

  for (const box of wallColliders(true)) {
    addBox(rapierWorld, box);
  }
  for (const module of description.modules) {
    if (!module.blocksMovement) continue;
    addBox(rapierWorld, module.collision);
  }
  const door = rapierWorld.createCollider(
    boxDesc(description.exit.collision),
  );

  const centerY = CAPSULE_HALF + PLAYER_RADIUS;
  const body = rapierWorld.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
      description.spawn.x,
      centerY,
      description.spawn.z,
    ),
  );
  const collider = rapierWorld.createCollider(
    RAPIER.ColliderDesc.capsule(CAPSULE_HALF, PLAYER_RADIUS),
    body,
  );
  const controller = rapierWorld.createCharacterController(0.04);
  controller.enableSnapToGround(0.3);
  controller.setApplyImpulsesToDynamicBodies(false);
  controller.enableAutostep(0.3, 0.2, true);

  let yaw = 0;
  let pitch = 0;
  let accumulator = 0;
  let disposed = false;

  const pose = (): Pose => {
    const position = body.translation();
    const feet = position.y - centerY;
    return {
      position: { x: position.x, y: feet + EYE_HEIGHT, z: position.z },
      yaw,
      pitch,
    };
  };

  const slide = (input: InputFrame, dt: number) => {
    const length = Math.hypot(input.moveX, input.moveZ);
    const moveX = length > 1 ? input.moveX / length : input.moveX;
    const moveZ = length > 1 ? input.moveZ / length : input.moveZ;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    // Camera column 0 is screen-right. At yaw 0 that is −X, the opposite of (cos yaw, −sin yaw).
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);
    controller.computeColliderMovement(collider, {
      x: (forwardX * moveZ + rightX * moveX) * MOVE_SPEED * dt,
      y: -3 * dt,
      z: (forwardZ * moveZ + rightZ * moveX) * MOVE_SPEED * dt,
    });
    const movement = controller.computedMovement();
    const current = body.translation();
    body.setNextKinematicTranslation({
      x: current.x + movement.x,
      y: Math.max(centerY, current.y + movement.y),
      z: current.z + movement.z,
    });
    rapierWorld.step();
  };

  return {
    step(input, deltaSeconds) {
      if (disposed) return;
      yaw -= input.lookX;
      pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch + input.lookY));
      accumulator += Math.max(0, deltaSeconds);
      let steps = 0;
      while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
        slide(input, FIXED_DT);
        accumulator -= FIXED_DT;
        steps += 1;
      }
    },
    setDoorOpen(open) {
      if (disposed) return;
      door.setEnabled(!open);
    },
    getPose: pose,
    dispose() {
      if (disposed) return;
      disposed = true;
      rapierWorld.free();
    },
  };
}

function boxDesc(box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }) {
  const hx = Math.max(0.02, (box.max.x - box.min.x) / 2);
  const hy = Math.max(0.02, (box.max.y - box.min.y) / 2);
  const hz = Math.max(0.02, (box.max.z - box.min.z) / 2);
  return RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  );
}

function addBox(
  rapierWorld: RAPIER.World,
  box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } },
) {
  rapierWorld.createCollider(boxDesc(box));
}
