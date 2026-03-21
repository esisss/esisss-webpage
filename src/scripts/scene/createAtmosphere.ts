import * as THREE from "three";

interface MistUniforms {
  [uniform: string]: THREE.IUniform;
  uTime: THREE.IUniform<number>;
  uNoise: THREE.IUniform<THREE.Texture>;
  uOpacity: THREE.IUniform<number>;
  uScroll: THREE.IUniform<THREE.Vector2>;
  uColorCool: THREE.IUniform<THREE.Color>;
  uColorWarm: THREE.IUniform<THREE.Color>;
  uCameraPosition: THREE.IUniform<THREE.Vector3>;
  uWarmLightPos: THREE.IUniform<THREE.Vector3>;
  uWarmLightStrength: THREE.IUniform<number>;
  uHeightFade: THREE.IUniform<THREE.Vector2>;
  uNearFade: THREE.IUniform<THREE.Vector2>;
}

const mistVertexShader = `
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const mistFragmentShader = `
precision highp float;

uniform float uTime;
uniform sampler2D uNoise;
uniform float uOpacity;
uniform vec2 uScroll;
uniform vec3 uColorCool;
uniform vec3 uColorWarm;
uniform vec3 uCameraPosition;
uniform vec3 uWarmLightPos;
uniform float uWarmLightStrength;
uniform vec2 uHeightFade;
uniform vec2 uNearFade;

varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vec2 uvA = vec2(vUv.x * 1.15, vUv.y * 0.8) + uScroll * uTime;
  vec2 uvB = vec2(vUv.x * 2.2, vUv.y * 1.45) - uScroll.yx * (uTime * 0.4);
  vec2 uvC = vec2(vUv.x * 0.55, vUv.y * 0.4) + uScroll * (uTime * 0.18);

  float nA = texture2D(uNoise, uvA).r;
  float nB = texture2D(uNoise, uvB).r;
  float nC = texture2D(uNoise, uvC).r;
  float n = nA * 0.5 + nB * 0.3 + nC * 0.2;
  n = smoothstep(0.18, 0.82, n);

  float breakup = mix(0.72, 1.0, n);
  float edgeX = smoothstep(0.0, 0.05, vUv.x) * (1.0 - smoothstep(0.95, 1.0, vUv.x));
  float edgeY = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.86 + n * 0.08, 1.0, vUv.y));

  float heightFade = 1.0 - smoothstep(uHeightFade.x, uHeightFade.y, clamp(vUv.y, 0.0, 1.0));

  float dToCamera = length(vWorldPosition - uCameraPosition);
  float nearFade = smoothstep(uNearFade.x, uNearFade.y, dToCamera);

  float warmDist = length(vWorldPosition - uWarmLightPos);
  float warmInfluence = (1.0 - smoothstep(18.0, 90.0, warmDist)) * uWarmLightStrength;
  vec3 color = mix(uColorCool, uColorWarm, clamp(warmInfluence, 0.0, 0.7));

  float alpha = uOpacity * breakup * edgeX * edgeY * heightFade * nearFade;
  alpha = clamp(alpha * 1.15, 0.0, 0.85);

  if (alpha < 0.001) discard;
  gl_FragColor = vec4(color, alpha);
}
`;

function createNoiseTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    const fallback = new THREE.Texture();
    fallback.needsUpdate = true;
    return fallback;
  }

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const value = Math.floor(Math.random() * 255);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createSoftGradientTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    const fallback = new THREE.Texture();
    fallback.needsUpdate = true;
    return fallback;
  }

  // Vertical soft fade: denser at lower-mid band, fades at top/bottom
  const gradient = ctx.createLinearGradient(0, size, 0, 0);
  gradient.addColorStop(0.0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.2, "rgba(255,255,255,0.35)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.9, "rgba(255,255,255,0.12)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function createMistMaterial(
  noiseTexture: THREE.Texture,
  opacity: number,
  scroll: THREE.Vector2,
) {
  const uniforms: MistUniforms = {
    uTime: { value: 0 },
    uNoise: { value: noiseTexture },
    uOpacity: { value: opacity },
    uScroll: { value: scroll },
    uColorCool: { value: new THREE.Color(0x7a8d9f) },
    uColorWarm: { value: new THREE.Color(0xc66d2e) },
    uCameraPosition: { value: new THREE.Vector3() },
    uWarmLightPos: { value: new THREE.Vector3(0, -8, -30) },
    uWarmLightStrength: { value: 0 },
    uHeightFade: { value: new THREE.Vector2(0.0, 0.78) },
    uNearFade: { value: new THREE.Vector2(10, 65) },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: mistVertexShader,
    fragmentShader: mistFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
}

export function createAtmosphere(scene: THREE.Scene) {
  const fogColor = new THREE.Color(0x5f6d7c);
  const baseFogDensity = 0.0011;
  scene.fog = new THREE.FogExp2(fogColor, baseFogDensity);

  const mistGroup = new THREE.Group();
  const noiseTexture = createNoiseTexture(256);
  const coastGradientTexture = createSoftGradientTexture(256);

  const layerSpecs = [
    {
      z: -80,
      y: -4,
      width: 720,
      height: 90,
      opacity: 0.07,
      scroll: new THREE.Vector2(0.006, 0.0024),
    },
    {
      z: -180,
      y: -6,
      width: 940,
      height: 120,
      opacity: 0.13,
      scroll: new THREE.Vector2(0.0052, 0.0021),
    },
    {
      z: -320,
      y: -5,
      width: 1240,
      height: 170,
      opacity: 0.24,
      scroll: new THREE.Vector2(0.0046, 0.0018),
    },
    {
      z: -370,
      y: -4,
      width: 1620,
      height: 240,
      opacity: 0.36,
      scroll: new THREE.Vector2(0.0039, 0.0014),
    },
  ];

  const materials: THREE.ShaderMaterial[] = [];
  const meshes: THREE.Mesh[] = [];
  const baseOpacity: number[] = [];
  const basePosition: THREE.Vector3[] = [];
  const baseScale: THREE.Vector3[] = [];

  for (let i = 0; i < layerSpecs.length; i++) {
    const spec = layerSpecs[i];
    const material = createMistMaterial(
      noiseTexture,
      spec.opacity,
      spec.scroll,
    );
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.width, spec.height),
      material,
    );
    mesh.position.set(0, spec.y, spec.z);

    materials.push(material);
    meshes.push(mesh);
    baseOpacity.push(spec.opacity);
    basePosition.push(mesh.position.clone());
    baseScale.push(mesh.scale.clone());

    mistGroup.add(mesh);
  }

  // Extra fixed haze band to softly obscure mountain coastlines
  const coastLayer = new THREE.Mesh(
    new THREE.PlaneGeometry(2200, 360),
    new THREE.MeshBasicMaterial({
      color: 0x6f8091,
      alphaMap: coastGradientTexture,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  coastLayer.position.set(0, -2, -150);
  coastLayer.renderOrder = 1; // Ensure it renders after mist layers for proper blending
  mistGroup.add(coastLayer);

  const mistAnchor = new THREE.Vector3(0, 0, 0);
  mistGroup.position.copy(mistAnchor);

  let warmLight: THREE.PointLight | null = null;
  let mistRadius = 1.0;
  let mistDensity = 1.0;
  let mistHeight = 1.0;
  const warmPos = new THREE.Vector3();
  const camPos = new THREE.Vector3();

  const setWarmLight = (light: THREE.PointLight | null) => {
    warmLight = light;
  };

  const setMistRadius = (radiusMultiplier: number) => {
    mistRadius = THREE.MathUtils.clamp(radiusMultiplier, 0.5, 2.8);
    meshes.forEach((mesh, i) => {
      mesh.position.x = basePosition[i].x * mistRadius;
      mesh.position.z = basePosition[i].z * mistRadius;
      mesh.scale.x = baseScale[i].x * mistRadius;
      mesh.scale.z = baseScale[i].z;
    });
  };

  const setMistHeight = (heightMultiplier: number) => {
    mistHeight = THREE.MathUtils.clamp(heightMultiplier, 0.35, 2.8);
    meshes.forEach((mesh, i) => {
      mesh.position.y = basePosition[i].y * mistHeight;
      mesh.scale.y = baseScale[i].y * mistHeight;
    });
  };

  const setMistDensity = (densityMultiplier: number) => {
    mistDensity = THREE.MathUtils.clamp(densityMultiplier, 0.2, 10.0);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = (baseFogDensity * mistDensity) / 3.5;
    }
    materials.forEach((material, i) => {
      material.uniforms.uOpacity.value = baseOpacity[i] * mistDensity;
    });
  };

  const setMistPosition = (x: number, y: number, z: number) => {
    mistAnchor.set(x, y, z);
    mistGroup.position.copy(mistAnchor);
  };

  const setMistY = (y: number) => {
    mistAnchor.y = y;
    mistGroup.position.y = y;
  };

  const update = (delta: number, camera: THREE.Camera) => {
    camera.getWorldPosition(camPos);
    if (warmLight?.visible) {
      warmLight.getWorldPosition(warmPos);
    }

    const warmStrength = warmLight
      ? THREE.MathUtils.clamp(warmLight.intensity / 1200, 0, 1)
      : 0;

    materials.forEach((material, i) => {
      material.uniforms.uTime.value += delta;
      material.uniforms.uCameraPosition.value.copy(camPos);
      material.uniforms.uWarmLightPos.value.copy(warmPos);
      material.uniforms.uWarmLightStrength.value = warmStrength;

      // Tiny drift to avoid dead-still look while preserving layered planes
      meshes[i].position.x =
        basePosition[i].x * mistRadius +
        Math.sin(material.uniforms.uTime.value * (0.05 + i * 0.01)) *
          (1.5 + i * 0.3);
    });
  };

  return {
    fogColor,
    mistGroup,
    update,
    setWarmLight,
    setMistRadius,
    setMistHeight,
    setMistDensity,
    setMistPosition,
    setMistY,
  };
}
