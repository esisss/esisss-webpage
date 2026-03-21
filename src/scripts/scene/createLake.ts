import * as THREE from "three";

// Shared wave functions (used in both shaders)
const waveNoiseGLSL = `
// Hash function for noise
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

// 2D noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return -1.0 + 2.0 * mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Wave octave function
float waveOctave(vec2 uv, float choppy) {
  uv += noise(uv);
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

// Calculate wave height at position
float getWaveHeight(vec2 pos, float uTime, float uWaveSpeed, float uWaveFreq, float uWaveHeight, float uWaveChoppy) {
  float freq = uWaveFreq;
  float amp = uWaveHeight;
  float choppy = uWaveChoppy;
  float seaTime = uTime * uWaveSpeed;

  vec2 uv = pos * 0.1;
  mat2 octaveMatrix = mat2(1.6, 1.2, -1.2, 1.6);

  float height = 0.0;

  for (int i = 0; i < 4; i++) {
    float d = waveOctave((uv + seaTime) * freq, choppy);
    d += waveOctave((uv - seaTime) * freq, choppy);
    height += d * amp;

    uv *= octaveMatrix;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return height;
}
`;

// Vertex Shader - With vertex displacement
const lakeVertexShader = `
precision highp float;

uniform float uTime;
uniform float uWaveSpeed;
uniform float uWaveFreq;
uniform float uWaveHeight;
uniform float uWaveChoppy;

varying vec2 vUv;
varying vec3 vWorldPosition;

${waveNoiseGLSL}

void main() {
  vUv = uv;

  // Get world position for wave calculation
  vec4 worldPos = modelMatrix * vec4(position, 1.0);

  // Calculate wave displacement
  float waveY = getWaveHeight(
    worldPos.xz,
    uTime,
    uWaveSpeed,
    uWaveFreq,
    uWaveHeight,
    uWaveChoppy
  );

  // Apply displacement to world Y
  worldPos.y += waveY;

  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

// Fragment Shader - Procedural water with waves, fresnel, and lighting
const lakeFragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uCameraPosition;

// Water appearance
uniform float uWaveHeight;
uniform float uWaveChoppy;
uniform float uWaveSpeed;
uniform float uWaveFreq;
uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;
uniform float uFresnelPower;
uniform float uSpecularStrength;
uniform float uDiffuseStrength;

// Light direction (normalized)
uniform vec3 uLightDirection;
uniform int uPointLightCount;
uniform vec3 uPointLightPositions[2];
uniform vec3 uPointLightColors[2];
uniform float uPointLightIntensities[2];
uniform float uPointLightRanges[2];
uniform float uPointLightDecays[2];
uniform int uSpotLightCount;
uniform vec3 uSpotLightPositions[2];
uniform vec3 uSpotLightDirections[2];
uniform vec3 uSpotLightColors[2];
uniform float uSpotLightIntensities[2];
uniform float uSpotLightRanges[2];
uniform float uSpotLightDecays[2];
uniform float uSpotLightInnerCos[2];
uniform float uSpotLightOuterCos[2];
uniform float uDynamicDiffuseGain;
uniform float uDynamicSpecularGain;
uniform float uMaxDynamicContribution;

varying vec2 vUv;
varying vec3 vWorldPosition;

const float PI = 3.14159265359;
const int WAVE_OCTAVES = 4;

// Hash function for noise
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

// 2D noise
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return -1.0 + 2.0 * mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Wave octave function
float waveOctave(vec2 uv, float choppy) {
  uv += noise(uv);
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

// Calculate wave height with screen-space-aware detail reduction
// pixelFootprint: size of a pixel in world space (from fwidth)
float getWaveHeight(vec2 pos, float pixelFootprint) {
  float freq = uWaveFreq;
  float amp = uWaveHeight;
  float choppy = uWaveChoppy;
  float seaTime = uTime * uWaveSpeed;

  vec2 uv = pos * 0.1;
  mat2 octaveMatrix = mat2(1.6, 1.2, -1.2, 1.6);

  float height = 0.0;
  float cumFreq = freq * 0.1;

  for (int i = 0; i < WAVE_OCTAVES; i++) {
    // How well can this octave be resolved by current pixel?
    float wavelength = 1.0 / max(cumFreq, 0.001);
    float pixelsPerWave = wavelength / max(pixelFootprint, 0.001);
    // Fade smoothly: full detail above 4 pixels/wave, gone below 1.5
    float octaveWeight = smoothstep(1.5, 4.0, pixelsPerWave);
    // Also soften choppiness for borderline octaves to reduce harsh edges
    float localChoppy = mix(1.0, choppy, clamp(octaveWeight * 1.5, 0.0, 1.0));

    float d = waveOctave((uv + seaTime) * freq, localChoppy);
    d += waveOctave((uv - seaTime) * freq, localChoppy);
    height += d * amp * octaveWeight;

    uv *= octaveMatrix;
    cumFreq *= 1.9 * 1.6;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }

  return height;
}

// Calculate normal from height field with screen-space aware sampling
vec3 getWaveNormal(vec2 pos, float pixelFootprint) {
  // Sample epsilon: large enough to avoid sub-pixel noise, small enough for detail
  float eps = max(pixelFootprint * 0.75, 0.08);

  float h  = getWaveHeight(pos, pixelFootprint);
  float hx = getWaveHeight(pos + vec2(eps, 0.0), pixelFootprint);
  float hz = getWaveHeight(pos + vec2(0.0, eps), pixelFootprint);

  vec3 normal;
  normal.x = h - hx;
  normal.z = h - hz;
  normal.y = eps;

  return normalize(normal);
}

// Diffuse lighting
float diffuse(vec3 n, vec3 l, float power) {
  return pow(dot(n, l) * 0.4 + 0.6, power);
}

// Specular lighting
float specular(vec3 n, vec3 l, vec3 e, float shininess) {
  float nrm = (shininess + 8.0) / (PI * 8.0);
  return pow(max(dot(reflect(e, n), l), 0.0), shininess) * nrm;
}

float getLightAttenuation(float distanceToLight, float range, float decay) {
  if (range <= 0.0) {
    return 1.0 / (1.0 + distanceToLight * distanceToLight * 0.02);
  }

  float normalizedDistance = clamp(distanceToLight / range, 0.0, 1.0);
  float falloff = pow(normalizedDistance, max(decay, 0.0001));
  return (1.0 - falloff) * (1.0 - falloff);
}

float getSpotConeFactor(float angleCos, float innerCos, float outerCos) {
  float denom = max(innerCos - outerCos, 0.0001);
  return clamp((angleCos - outerCos) / denom, 0.0, 1.0);
}

// Environment/sky reflection color based on reflection direction
vec3 getEnvironmentColor(vec3 reflectDir) {
  // Sky dome color matching createSky.ts (0x8a9bad = rgb(138, 155, 173))
  vec3 skyBase = vec3(0.541, 0.608, 0.678);

  // Gradient from horizon to zenith
  float elevation = reflectDir.y;

  // Horizon is slightly warmer/lighter, zenith is cooler
  vec3 horizonColor = vec3(0.65, 0.68, 0.72);  // Lighter gray-blue at horizon
  vec3 zenithColor = vec3(0.48, 0.55, 0.65);   // Cooler blue at zenith

  // Mountain silhouette simulation (dark when looking at low angles)
  vec3 mountainColor = vec3(0.15, 0.18, 0.22); // Dark mountain silhouette

  // Blend based on reflection elevation
  vec3 envColor;

  if (elevation < 0.0) {
    // Looking down - darker (underwater hint)
    envColor = mix(mountainColor, horizonColor, 0.3);
  } else if (elevation < 0.15) {
    // Near horizon - mountain silhouettes
    float t = elevation / 0.15;
    envColor = mix(mountainColor, horizonColor, t * t);
  } else if (elevation < 0.5) {
    // Lower sky - transition
    float t = (elevation - 0.15) / 0.35;
    envColor = mix(horizonColor, skyBase, t);
  } else {
    // Upper sky
    float t = (elevation - 0.5) / 0.5;
    envColor = mix(skyBase, zenithColor, t);
  }

  // Add subtle variation based on horizontal angle
  float azimuth = atan(reflectDir.z, reflectDir.x);
  envColor += 0.02 * sin(azimuth * 2.0);

  return envColor;
}

void main() {
  vec2 pos = vWorldPosition.xz;

  // Screen-space pixel footprint: how large is one pixel in world space
  // This naturally accounts for both distance AND grazing angle
  float pixelFootprint = length(fwidth(vWorldPosition.xz));

  // Distance for fog and other distance-only effects
  float distanceToCamera = length(uCameraPosition - vWorldPosition);

  // Calculate two normal bands and blend by distance.
  // This keeps close detail while removing high-frequency shimmer far away.
  float fineFootprint = max(pixelFootprint, 0.08);
  float coarseFootprint = max(pixelFootprint * 2.4, 0.22);
  vec3 normalFine = getWaveNormal(pos, fineFootprint);
  vec3 normalCoarse = getWaveNormal(pos, coarseFootprint);

  float distanceFade = smoothstep(150.0, 650.0, distanceToCamera);
  vec3 normal = normalize(mix(normalFine, normalCoarse, distanceFade));

  // Small extra flattening only in the far field
  normal = normalize(mix(normal, vec3(0.0, 1.0, 0.0), distanceFade * 0.35));

  // View direction
  vec3 viewDir = normalize(uCameraPosition - vWorldPosition);

  // Reflection direction
  vec3 reflectDir = reflect(-viewDir, normal);

  // Fresnel effect - stronger at grazing angles (realistic water behavior)
  float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
  fresnel = pow(fresnel, uFresnelPower);

  // Schlick's approximation for more realistic fresnel
  float F0 = 0.02; // Water's base reflectivity
  float schlickFresnel = F0 + (1.0 - F0) * pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);

  // Combine fresnel approaches
  float reflectivity = mix(fresnel, schlickFresnel, 0.5);
  reflectivity = clamp(reflectivity, 0.1, 0.95);

  // Get environment reflection
  vec3 reflectionColor = getEnvironmentColor(reflectDir);

  // Deep water color (what you see when looking straight down)
  vec3 waterColor = mix(uWaterDeep, uWaterShallow, reflectivity * 0.3);

  // Blend water with reflection based on fresnel
  // More reflection at grazing angles, more water color when looking down
  vec3 color = mix(waterColor, reflectionColor, reflectivity);

  // Lighting
  vec3 lightDir = normalize(uLightDirection);

  // Soft diffuse for ambient light on waves
  float diff = diffuse(normal, lightDir, 2.0);
  color += uWaterShallow * diff * uDiffuseStrength * (1.0 - reflectivity);

  // Specular highlights (sun glints) - fade gently at distance
  float specularDistanceFade = 1.0 - smoothstep(150.0, 500.0, distanceToCamera);
  float spec = specular(normal, lightDir, -viewDir, 60.0);
  color += vec3(1.0) * spec * uSpecularStrength * specularDistanceFade;

  vec3 dynamicLightContribution = vec3(0.0);

  // Point lights
  for (int i = 0; i < 2; i++) {
    if (i >= uPointLightCount) continue;

    vec3 toPoint = uPointLightPositions[i] - vWorldPosition;
    float pointDistance = length(toPoint);
    if (pointDistance <= 0.0001) continue;

    vec3 pointDir = toPoint / pointDistance;
    float pointAttenuation = getLightAttenuation(
      pointDistance,
      uPointLightRanges[i],
      uPointLightDecays[i]
    );

    float pointDiffuse = max(dot(normal, pointDir), 0.0);
    float pointSpecular = specular(normal, pointDir, -viewDir, 48.0);
    vec3 pointColor = uPointLightColors[i] * uPointLightIntensities[i] * pointAttenuation;

    dynamicLightContribution +=
      pointColor * pointDiffuse * uDiffuseStrength * uDynamicDiffuseGain * 0.35;
    dynamicLightContribution +=
      pointColor * pointSpecular * uSpecularStrength * uDynamicSpecularGain * 0.55 * specularDistanceFade;
  }

  // Spot lights
  for (int i = 0; i < 2; i++) {
    if (i >= uSpotLightCount) continue;

    vec3 toSpot = uSpotLightPositions[i] - vWorldPosition;
    float spotDistance = length(toSpot);
    if (spotDistance <= 0.0001) continue;

    vec3 spotDirToSurface = normalize(vWorldPosition - uSpotLightPositions[i]);
    float angleCos = dot(normalize(uSpotLightDirections[i]), spotDirToSurface);
    float cone = getSpotConeFactor(
      angleCos,
      uSpotLightInnerCos[i],
      uSpotLightOuterCos[i]
    );

    if (cone <= 0.0) continue;

    vec3 spotDir = toSpot / spotDistance;
    float spotAttenuation = getLightAttenuation(
      spotDistance,
      uSpotLightRanges[i],
      uSpotLightDecays[i]
    );
    float spotDiffuse = max(dot(normal, spotDir), 0.0);
    float spotSpecular = specular(normal, spotDir, -viewDir, 56.0);
    vec3 spotColor =
      uSpotLightColors[i] * uSpotLightIntensities[i] * spotAttenuation * cone;

    dynamicLightContribution +=
      spotColor * spotDiffuse * uDiffuseStrength * uDynamicDiffuseGain * 0.4;
    dynamicLightContribution +=
      spotColor * spotSpecular * uSpecularStrength * uDynamicSpecularGain * 0.65 * specularDistanceFade;
  }

  float fresnelBoost = mix(0.82, 1.08, fresnel);
  dynamicLightContribution *= fresnelBoost;
  dynamicLightContribution = min(
    dynamicLightContribution,
    vec3(uMaxDynamicContribution)
  );
  color += dynamicLightContribution;

  // Distance fog (atmospheric perspective)
  float fogFactor = 1.1 - smoothstep(80.0, 400.0, distanceToCamera);
  vec3 fogColor = vec3(0.6, 0.65, 0.7); // Match atmospheric fog
  color = mix(fogColor, color, fogFactor * 0.5 + 0.5);

  // Subtle gamma correction
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 0.98);
}
`;

export interface LakeUniforms {
  [uniform: string]: THREE.IUniform;
  uTime: THREE.IUniform<number>;
  uCameraPosition: THREE.IUniform<THREE.Vector3>;
  uWaveHeight: THREE.IUniform<number>;
  uWaveChoppy: THREE.IUniform<number>;
  uWaveSpeed: THREE.IUniform<number>;
  uWaveFreq: THREE.IUniform<number>;
  uWaterDeep: THREE.IUniform<THREE.Color>;
  uWaterShallow: THREE.IUniform<THREE.Color>;
  uFresnelPower: THREE.IUniform<number>;
  uSpecularStrength: THREE.IUniform<number>;
  uDiffuseStrength: THREE.IUniform<number>;
  uLightDirection: THREE.IUniform<THREE.Vector3>;
  uPointLightCount: THREE.IUniform<number>;
  uPointLightPositions: THREE.IUniform<THREE.Vector3[]>;
  uPointLightColors: THREE.IUniform<THREE.Color[]>;
  uPointLightIntensities: THREE.IUniform<number[]>;
  uPointLightRanges: THREE.IUniform<number[]>;
  uPointLightDecays: THREE.IUniform<number[]>;
  uSpotLightCount: THREE.IUniform<number>;
  uSpotLightPositions: THREE.IUniform<THREE.Vector3[]>;
  uSpotLightDirections: THREE.IUniform<THREE.Vector3[]>;
  uSpotLightColors: THREE.IUniform<THREE.Color[]>;
  uSpotLightIntensities: THREE.IUniform<number[]>;
  uSpotLightRanges: THREE.IUniform<number[]>;
  uSpotLightDecays: THREE.IUniform<number[]>;
  uSpotLightInnerCos: THREE.IUniform<number[]>;
  uSpotLightOuterCos: THREE.IUniform<number[]>;
  uDynamicDiffuseGain: THREE.IUniform<number>;
  uDynamicSpecularGain: THREE.IUniform<number>;
  uMaxDynamicContribution: THREE.IUniform<number>;
}

export interface LakePreset {
  waveHeight: number;
  waveChoppy: number;
  waveSpeed: number;
  waveFreq: number;
  waterDeep: THREE.Color;
  waterShallow: THREE.Color;
  fresnelPower: number;
  specularStrength: number;
  diffuseStrength: number;
  dynamicDiffuseGain: number;
  dynamicSpecularGain: number;
  maxDynamicContribution: number;
}

// Presets for different water moods
export const lakePresets: Record<string, LakePreset> = {
  // Calm Nordic lake - subtle but visible movement
  calm: {
    waveHeight: 0.8,
    waveChoppy: 3.8,
    waveSpeed: 0.5,
    waveFreq: 1,
    waterDeep: new THREE.Color(0x1a3a4a), // Dark steel blue
    waterShallow: new THREE.Color(0x5a8a9a), // Lighter steel blue
    fresnelPower: 10,
    specularStrength: 0.3,
    diffuseStrength: 0,
    dynamicDiffuseGain: 1,
    dynamicSpecularGain: 0.004,
    maxDynamicContribution: 2,
  },
  // Slightly more active
  gentle: {
    waveHeight: 0.15,
    waveChoppy: 1.0,
    waveSpeed: 0.25,
    waveFreq: 0.12,
    waterDeep: new THREE.Color(0x182830),
    waterShallow: new THREE.Color(0x4a6a78),
    fresnelPower: 2.5,
    specularStrength: 0.25,
    diffuseStrength: 0.08,
    dynamicDiffuseGain: 0.78,
    dynamicSpecularGain: 10.72,
    maxDynamicContribution: 0.3,
  },
  // Windy conditions
  rough: {
    waveHeight: 1.7,
    waveChoppy: 1.5,
    waveSpeed: 0.5,
    waveFreq: 0.7,
    waterDeep: new THREE.Color(0x0f1f28),
    waterShallow: new THREE.Color(0x5a7a88),
    fresnelPower: 1000,
    specularStrength: 0.4,
    diffuseStrength: 0,
    dynamicDiffuseGain: 1.0,
    dynamicSpecularGain: 0.004,
    maxDynamicContribution: 2,
  },
};

export function createLake() {
  const lakeGroup = new THREE.Group();

  // Create uniforms
  const uniforms: LakeUniforms = {
    uTime: { value: 0 },
    uCameraPosition: { value: new THREE.Vector3() },
    uWaveHeight: { value: 0.08 },
    uWaveChoppy: { value: 0.6 },
    uWaveSpeed: { value: 0.15 },
    uWaveFreq: { value: 0.08 },
    uWaterDeep: { value: new THREE.Color(0x1a2a33) },
    uWaterShallow: { value: new THREE.Color(0x3a5a6a) },
    uFresnelPower: { value: 3.0 },
    uSpecularStrength: { value: 0.15 },
    uDiffuseStrength: { value: 0.05 },
    uLightDirection: { value: new THREE.Vector3(0.3, 1.0, 0.5).normalize() },
    uPointLightCount: { value: 0 },
    uPointLightPositions: {
      value: [new THREE.Vector3(), new THREE.Vector3()],
    },
    uPointLightColors: {
      value: [new THREE.Color(0x000000), new THREE.Color(0x000000)],
    },
    uPointLightIntensities: { value: [0, 0] },
    uPointLightRanges: { value: [0, 0] },
    uPointLightDecays: { value: [1, 1] },
    uSpotLightCount: { value: 0 },
    uSpotLightPositions: {
      value: [new THREE.Vector3(), new THREE.Vector3()],
    },
    uSpotLightDirections: {
      value: [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, -1, 0)],
    },
    uSpotLightColors: {
      value: [new THREE.Color(0x000000), new THREE.Color(0x000000)],
    },
    uSpotLightIntensities: { value: [0, 0] },
    uSpotLightRanges: { value: [0, 0] },
    uSpotLightDecays: { value: [1, 1] },
    uSpotLightInnerCos: { value: [0, 0] },
    uSpotLightOuterCos: { value: [0, 0] },
    uDynamicDiffuseGain: { value: 0.9 },
    uDynamicSpecularGain: { value: 0.85 },
    uMaxDynamicContribution: { value: 0.38 },
  };

  // Apply calm preset by default
  applyPreset(uniforms, "calm");

  // Create shader material
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: lakeVertexShader,
    fragmentShader: lakeFragmentShader,
    transparent: true,
    side: THREE.FrontSide,
  });

  // Create large horizontal plane with subdivisions for vertex displacement
  // More subdivisions = smoother waves but more vertices
  const geometry = new THREE.PlaneGeometry(800, 500, 256, 128);

  const lake = new THREE.Mesh(geometry, material);
  const lightPosition = new THREE.Vector3();
  const lightTarget = new THREE.Vector3();
  let cachedDirectionalLight: THREE.DirectionalLight | null = null;
  const cachedPointLights: THREE.PointLight[] = [];
  const cachedSpotLights: THREE.SpotLight[] = [];

  // Rotate to horizontal
  lake.rotation.x = -Math.PI / 2;

  // Position low
  lake.position.set(0, -10, 0);

  lakeGroup.add(lake);

  // Update function to be called in animation loop
  const update = (delta: number, camera: THREE.Camera) => {
    uniforms.uTime.value += delta;
    camera.getWorldPosition(uniforms.uCameraPosition.value);
    syncDynamicLights(cachedPointLights, cachedSpotLights);
    syncDirectionalLight(cachedDirectionalLight);
  };

  const syncDirectionalLight = (
    directionalLight: THREE.DirectionalLight | null,
  ) => {
    if (
      !directionalLight ||
      !directionalLight.visible ||
      directionalLight.intensity <= 0
    ) {
      return;
    }

    directionalLight.getWorldPosition(lightPosition);
    directionalLight.target.getWorldPosition(lightTarget);
    uniforms.uLightDirection.value
      .copy(lightPosition)
      .sub(lightTarget)
      .normalize();
  };

  const syncDynamicLights = (
    pointLights: THREE.PointLight[],
    spotLights: THREE.SpotLight[],
  ) => {
    const maxPointLights = 2;
    const maxSpotLights = 2;

    const pointCount = Math.min(pointLights.length, maxPointLights);
    uniforms.uPointLightCount.value = pointCount;

    for (let i = 0; i < maxPointLights; i++) {
      const light = pointLights[i];
      if (!light || !light.visible || light.intensity <= 0) {
        uniforms.uPointLightIntensities.value[i] = 0;
        uniforms.uPointLightRanges.value[i] = 0;
        uniforms.uPointLightDecays.value[i] = 1;
        uniforms.uPointLightColors.value[i].set(0x000000);
        uniforms.uPointLightPositions.value[i].set(0, 0, 0);
        continue;
      }

      light.getWorldPosition(lightPosition);
      uniforms.uPointLightPositions.value[i].copy(lightPosition);
      uniforms.uPointLightColors.value[i].copy(light.color);
      uniforms.uPointLightIntensities.value[i] = light.intensity;
      uniforms.uPointLightRanges.value[i] = light.distance;
      uniforms.uPointLightDecays.value[i] = light.decay;
    }

    const spotCount = Math.min(spotLights.length, maxSpotLights);
    uniforms.uSpotLightCount.value = spotCount;

    for (let i = 0; i < maxSpotLights; i++) {
      const light = spotLights[i];
      if (!light || !light.visible || light.intensity <= 0) {
        uniforms.uSpotLightIntensities.value[i] = 0;
        uniforms.uSpotLightRanges.value[i] = 0;
        uniforms.uSpotLightDecays.value[i] = 1;
        uniforms.uSpotLightInnerCos.value[i] = 0;
        uniforms.uSpotLightOuterCos.value[i] = 0;
        uniforms.uSpotLightColors.value[i].set(0x000000);
        uniforms.uSpotLightPositions.value[i].set(0, 0, 0);
        uniforms.uSpotLightDirections.value[i].set(0, -1, 0);
        continue;
      }

      light.getWorldPosition(lightPosition);
      light.target.getWorldPosition(lightTarget);

      uniforms.uSpotLightPositions.value[i].copy(lightPosition);
      uniforms.uSpotLightDirections.value[i]
        .copy(lightTarget)
        .sub(lightPosition)
        .normalize();
      uniforms.uSpotLightColors.value[i].copy(light.color);
      uniforms.uSpotLightIntensities.value[i] = light.intensity;
      uniforms.uSpotLightRanges.value[i] = light.distance;
      uniforms.uSpotLightDecays.value[i] = light.decay;

      const outerCos = Math.cos(light.angle);
      const innerCos = Math.cos(light.angle * (1 - light.penumbra));
      uniforms.uSpotLightOuterCos.value[i] = outerCos;
      uniforms.uSpotLightInnerCos.value[i] = innerCos;
    }
  };

  const setLightSources = (sources: {
    directionalLight?: THREE.DirectionalLight | null;
    pointLights?: THREE.PointLight[];
    spotLights?: THREE.SpotLight[];
  }) => {
    if (sources.directionalLight !== undefined) {
      cachedDirectionalLight = sources.directionalLight;
    }

    if (sources.pointLights) {
      cachedPointLights.length = 0;
      cachedPointLights.push(...sources.pointLights);
    }

    if (sources.spotLights) {
      cachedSpotLights.length = 0;
      cachedSpotLights.push(...sources.spotLights);
    }
  };

  const syncLightsFromScene = (scene: THREE.Scene) => {
    const pointLightsInScene: THREE.PointLight[] = [];
    const spotLightsInScene: THREE.SpotLight[] = [];
    const directionalLightsInScene: THREE.DirectionalLight[] = [];

    scene.traverse((object) => {
      if (!(object instanceof THREE.Light)) return;
      if (!object.visible || object.intensity <= 0) return;
      if (object.userData.excludeFromLake === true) return;

      if (object instanceof THREE.PointLight) {
        pointLightsInScene.push(object);
        return;
      }

      if (object instanceof THREE.SpotLight) {
        spotLightsInScene.push(object);
        return;
      }

      if (object instanceof THREE.DirectionalLight) {
        directionalLightsInScene.push(object);
      }
    });

    pointLightsInScene.sort((a, b) => b.intensity - a.intensity);
    spotLightsInScene.sort((a, b) => b.intensity - a.intensity);
    directionalLightsInScene.sort((a, b) => b.intensity - a.intensity);

    setLightSources({
      pointLights: pointLightsInScene,
      spotLights: spotLightsInScene,
    });

    const strongestDirectional = directionalLightsInScene[0];
    setLightSources({ directionalLight: strongestDirectional ?? null });
  };

  // Preset setter
  const setPreset = (presetName: string) => {
    applyPreset(uniforms, presetName);
  };

  return {
    lakeGroup,
    update,
    syncDynamicLights,
    syncLightsFromScene,
    setLightSources,
    setPreset,
    uniforms,
  };
}

function applyPreset(uniforms: LakeUniforms, presetName: string) {
  const preset = lakePresets[presetName];
  if (!preset) return;

  uniforms.uWaveHeight.value = preset.waveHeight;
  uniforms.uWaveChoppy.value = preset.waveChoppy;
  uniforms.uWaveSpeed.value = preset.waveSpeed;
  uniforms.uWaveFreq.value = preset.waveFreq;
  uniforms.uWaterDeep.value.copy(preset.waterDeep);
  uniforms.uWaterShallow.value.copy(preset.waterShallow);
  uniforms.uFresnelPower.value = preset.fresnelPower;
  uniforms.uSpecularStrength.value = preset.specularStrength;
  uniforms.uDiffuseStrength.value = preset.diffuseStrength;
  uniforms.uDynamicDiffuseGain.value = preset.dynamicDiffuseGain;
  uniforms.uDynamicSpecularGain.value = preset.dynamicSpecularGain;
  uniforms.uMaxDynamicContribution.value = preset.maxDynamicContribution;
}
