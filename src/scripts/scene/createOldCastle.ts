import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three-stdlib";
import oldCastleUrl from "../../assets/3D/old_castle.glb?url";
import {
  createMedievalWindow,
  createMedievalWindowSet,
} from "./createCastleWindows";

export interface CastleOptions {
  position?: { x: number; y: number; z: number };
  scale?: number | { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
}

export async function createOldCastle(
  options: CastleOptions = {},
): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const gltf = await loader.loadAsync(oldCastleUrl);
  const castle = gltf.scene.clone(true);

  // Same stylized material settings used by mid mountains
  const midMountainMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    roughness: 0.8,
  });

  castle.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = midMountainMaterial;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Add simple emissive medieval windows sized from castle bounds,
  // so they remain visible regardless of model scale.
  const bounds = new THREE.Box3().setFromObject(castle);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  const windowWidth = size.x * 0.04;
  const windowHeight = size.y * 0.055;
  const windowDepth = size.z * 0.006;
  const windowSet = createMedievalWindowSet({
    count: 2,
    spacing: windowWidth * 16.45,
    color: 0x8a3f16,
    emissiveColor: 0xffb347,
    emissiveIntensity: 2.6,
    glowScale: 1,
    lightIntensity: 0.5,
    lightDistance: 100,
    height: windowHeight,
    width: windowWidth,
    depth: windowDepth,
  });
  const sideTowerWindow1 = createMedievalWindow({
    color: 0x8a3f16,
    emissiveColor: 0xffb347,
    emissiveIntensity: 2.6,
    glowScale: 1,
    lightIntensity: 0.5,
    lightDistance: 100,
    height: windowHeight,
    width: windowWidth,
    depth: windowDepth,
  });
  const sideTowerWindow2 = createMedievalWindow({
    color: 0x8a3f16,
    emissiveColor: 0xffb347,
    emissiveIntensity: 2.6,
    glowScale: 1,
    lightIntensity: 0.5,
    lightDistance: 100,
    height: windowHeight,
    width: windowWidth,
    depth: windowDepth,
  });
  const {
    position = { x: 0, y: -12, z: -230 },
    scale = 1,
    rotation = { x: 0, y: 0, z: 0 },
  } = options;

  castle.position.set(position.x, position.y, position.z);
  castle.add(windowSet);
  castle.add(sideTowerWindow1);
  castle.add(sideTowerWindow2);
  sideTowerWindow1.position.set(
    center.x - size.x * 0.49,
    bounds.min.y + size.y * 0.68,
    0.26,
  );
  sideTowerWindow2.position.set(
    center.x - size.x * -0.2,
    bounds.min.y + size.y * 0.68,
    0.26,
  );
  sideTowerWindow1.rotateY(Math.PI * 0.45);
  sideTowerWindow2.rotateY(Math.PI * -0.45);
  windowSet.position.set(center.x, bounds.min.y + size.y * 0.68, 0.37);
  windowSet.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.renderOrder = 5;
    }
  });
  if (typeof scale === "number") {
    castle.scale.setScalar(scale);
  } else {
    castle.scale.set(scale.x, scale.y, scale.z);
  }

  castle.rotation.set(rotation.x, rotation.y, rotation.z);

  return castle;
}
