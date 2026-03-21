import * as THREE from "three";
import moonTextureUrl from "../../assets/moonnobg.png?url";

function createMoonGlowTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    const fallback = new THREE.Texture();
    fallback.needsUpdate = true;
    return fallback;
  }

  const center = size / 2;
  const gradient = context.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    center,
  );
  gradient.addColorStop(0.0, "rgba(255, 250, 220, 0.95)");
  gradient.addColorStop(0.3, "rgba(255, 236, 170, 0.65)");
  gradient.addColorStop(0.65, "rgba(255, 220, 140, 0.28)");
  gradient.addColorStop(1.0, "rgba(255, 205, 120, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createMoon() {
  const moonRenderBaseOrder = 10_000;

  const loader = new THREE.TextureLoader();
  const moonTexture = loader.load(moonTextureUrl);
  moonTexture.colorSpace = THREE.SRGBColorSpace;

  const moonMaterial = new THREE.MeshBasicMaterial({
    map: moonTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const moonMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(65, 36),
    moonMaterial,
  );
  moonMesh.position.set(55, 300, -680);
  moonMesh.lookAt(0, 0, 0);
  moonMesh.renderOrder = moonRenderBaseOrder + 1;
  moonMesh.frustumCulled = false;

  const glowMaterial = new THREE.SpriteMaterial({
    map: createMoonGlowTexture(),
    color: 0xfff0b8,
    transparent: false,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    fog: false,
  });
  const glowSprite = new THREE.Sprite(glowMaterial);
  glowSprite.position.copy(moonMesh.position);
  glowSprite.scale.set(180, 180, 1);
  glowSprite.renderOrder = moonRenderBaseOrder;
  glowSprite.frustumCulled = false;

  const coreGlowMaterial = new THREE.SpriteMaterial({
    map: createMoonGlowTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    fog: false,
  });
  const coreGlowSprite = new THREE.Sprite(coreGlowMaterial);
  coreGlowSprite.position.copy(moonMesh.position);
  coreGlowSprite.scale.set(100, 100, 1);
  coreGlowSprite.renderOrder = moonRenderBaseOrder + 2;
  coreGlowSprite.frustumCulled = false;

  const moonLight = new THREE.PointLight(0xfff7dd, 8.5, 1800, 1.35);
  moonLight.position.copy(moonMesh.position);

  const moonGroup = new THREE.Group();
  moonGroup.add(glowSprite);
  moonGroup.add(coreGlowSprite);
  moonGroup.add(moonMesh);
  moonGroup.add(moonLight);

  const update = (camera: THREE.Camera) => {
    moonMesh.lookAt(camera.position);
  };

  return { moonGroup, update };
}

export function createSky() {
  // We use a large sphere to represent the sky dome
  const geometry = new THREE.SphereGeometry(500, 32, 16);
  // Invert the geometry so we see the inside of the sphere
  geometry.scale(-2, 2, 2);

  // Cold gray-blue sky color
  const material = new THREE.MeshBasicMaterial({
    color: 0x8a9bad,
    fog: false, // Sky shouldn't be affected by scene fog
  });

  const sky = new THREE.Mesh(geometry, material);
  const { moonGroup, update } = createMoon();
  sky.add(moonGroup);
  sky.userData.update = update;
  return sky;
}
