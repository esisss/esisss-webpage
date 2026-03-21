import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three-stdlib";
import dummyUrl from "../../assets/3D/dummy.glb?url";

export interface BoatPassengerOptions {
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: number;
  targetHeight?: number;
}

export async function createBoatPassenger(
  options: BoatPassengerOptions = {},
): Promise<THREE.Group> {
  const {
    position = { x: 0, y: 1.35, z: 0.2 },
    rotation = { x: 0, y: Math.PI * 0.45, z: 0 },
    scale = 5,
    targetHeight = 2.0,
  } = options;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const gltf = await loader.loadAsync(dummyUrl);
  const passenger = gltf.scene.clone(true);

  // Normalize origin and size so positioning on boat is predictable.
  const bounds = new THREE.Box3().setFromObject(passenger);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  passenger.position.sub(center);

  const groundedBounds = new THREE.Box3().setFromObject(passenger);
  passenger.position.y -= groundedBounds.min.y;

  const currentHeight = Math.max(size.y, 0.0001);
  const normalizeScale = targetHeight / currentHeight;
  passenger.scale.setScalar(normalizeScale * scale);

  passenger.position.set(position.x, position.y, position.z);
  passenger.rotation.set(rotation.x, rotation.y, rotation.z);

  passenger.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return passenger;
}
