import * as THREE from "three";

export function createCameraRig(fov: number, aspect: number) {
  const rig = new THREE.Group();

  // Create camera with cinematic FOV
  const camera = new THREE.PerspectiveCamera(fov, aspect, 10, 1500);

  camera.position.set(0, 0, 100); // Local origin within the rig
  camera.rotation.x = -Math.PI / 120; // Tilt down

  rig.add(camera);

  // Position rig
  rig.position.set(0, 1, 15);

  return { rig, camera };
}
