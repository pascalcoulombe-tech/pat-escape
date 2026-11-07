import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { raycastProxy } from '../src/runtime/proxy-raycast';

function boxInFront(): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.position.set(0, 0, -2);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function ray(): THREE.Raycaster {
  return new THREE.Raycaster(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1));
}

describe('rayon des boîtes de sélection', () => {
  it('touche encore une boîte rendue invisible par three 0.187', () => {
    const mesh = boxInFront();
    mesh.visible = false;
    const hits = ray().intersectObject(mesh, false);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('force la visibilité le temps du rayon si three se met à l’ignorer', () => {
    const mesh = boxInFront();
    mesh.visible = false;
    const original = mesh.raycast.bind(mesh);
    mesh.raycast = (raycaster, intersects) => {
      if (mesh.visible === false) return;
      original(raycaster, intersects);
    };
    const hits: THREE.Intersection[] = [];
    raycastProxy(mesh, ray(), hits);
    expect(hits.length).toBeGreaterThan(0);
    expect(mesh.visible).toBe(false);
  });
});
