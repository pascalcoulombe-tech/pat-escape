import type { Intersection, Object3D, Raycaster } from 'three';

// three 0.187's Raycaster.intersect does not consult visible, and Mesh.raycast
// does not return early when visible is false. Force it true for the call so a
// later visibility check cannot drop the selection proxy, then restore it.
export function raycastProxy(object: Object3D, raycaster: Raycaster, hits: Intersection[]): void {
  const previous = object.visible;
  object.visible = true;
  object.raycast(raycaster, hits);
  object.visible = previous;
}
