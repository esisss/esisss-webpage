import { animate, motionValue } from "motion";
import * as THREE from "three";

export interface BoatLightingController {
  boatLightingGroup: THREE.Group;
  fireLight: THREE.PointLight;
  update: () => void;
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const context = canvas.getContext("2d");
  if (!context) {
    const fallback = new THREE.Texture();
    fallback.needsUpdate = true;
    return fallback;
  }

  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0.0, "rgba(255, 236, 170, 1)");
  gradient.addColorStop(0.2, "rgba(255, 205, 110, 0.95)");
  gradient.addColorStop(0.5, "rgba(255, 158, 55, 0.5)");
  gradient.addColorStop(1.0, "rgba(255, 90, 0, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function createBoatLighting(): BoatLightingController {
  const boatLightingGroup = new THREE.Group();
  boatLightingGroup.position.set(0, 6.1, 0);

  const fireLight = new THREE.PointLight(0xffb84a, 180, 70, 2);
  fireLight.position.set(0, 0, 0);
  boatLightingGroup.add(fireLight);

  const bulbMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const bulbMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 10, 10),
    bulbMaterial,
  );
  boatLightingGroup.add(bulbMesh);

  const glowMaterial = new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color: 0xffc15a,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glowSprite = new THREE.Sprite(glowMaterial);
  glowSprite.scale.set(3, 3, 1);
  boatLightingGroup.add(glowSprite);

  const fireIntensityMV = motionValue(500);
  const fireColorMV = motionValue(0.5);
  const glowScaleMV = motionValue(2.2);
  const glowOpacityMV = motionValue(0.75);

  const fireCore = new THREE.Color(0xff9a2e);
  const fireHot = new THREE.Color(0xffda76);
  const fireTemp = new THREE.Color();

  animate(fireIntensityMV, [530, 520, 555, 545, 580, 530, 545, 505], {
    duration: 5,
    ease: "linear",
    repeat: Number.POSITIVE_INFINITY,
  });

  animate(fireColorMV, [0.15, 0.9, 0.35, 0.78, 0.22, 0.88], {
    duration: 5,
    ease: "linear",
    repeat: Number.POSITIVE_INFINITY,
  });

  animate(glowScaleMV, [2.0, 2.7, 2.2, 2.9, 2.1, 2.6], {
    duration: 5,
    ease: "easeInOut",
    repeat: Number.POSITIVE_INFINITY,
  });

  animate(glowOpacityMV, [0.55, 0.9, 0.62, 0.95, 0.58, 0.85], {
    duration: 5,
    ease: "easeInOut",
    repeat: Number.POSITIVE_INFINITY,
  });

  const update = () => {
    const mix = fireColorMV.get();
    fireTemp.lerpColors(fireCore, fireHot, mix);

    fireLight.intensity = fireIntensityMV.get();
    fireLight.color.copy(fireTemp);

    bulbMaterial.color.copy(fireTemp);

    glowMaterial.color.copy(fireTemp);
    glowMaterial.opacity = glowOpacityMV.get();
    const glowScale = glowScaleMV.get();
    glowSprite.scale.set(glowScale, glowScale, 1);
  };

  return { boatLightingGroup, fireLight, update };
}
