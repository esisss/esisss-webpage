import * as THREE from "three";
import { EffectComposer, RenderPass, ShaderPass } from "three-stdlib";

export function setupComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
) {
  // Config renderer encoding & tonemapping for cinematic feel
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Set up composer
  const composer = new EffectComposer(renderer);

  // 1. Render Pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Simple Vignette Pass
  const VignetteShader = {
    uniforms: {
      tDiffuse: { value: null },
      offset: { value: 1 },
      darkness: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float offset;
      uniform float darkness;
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        // Distance from center
        vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
        float dist = length(uv);
        // Darken edges
        texel.rgb *= smoothstep(0.8, dist * darkness, 0.4);
        gl_FragColor = texel;
      }
    `,
  };

  const vignettePass = new ShaderPass(VignetteShader);
  composer.addPass(vignettePass);

  return { composer };
}
