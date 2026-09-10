import * as THREE from 'three';

/**
 * SINGLE SOURCE OF TRUTH for HNC rendering.
 * Exact values from GameRenderer constructor (apps/game/src/renderer.ts).
 *
 * - outputColorSpace: SRGBColorSpace
 * - toneMapping: ACESFilmicToneMapping
 * - exposure: 1.12
 * - background: #7fb6e0
 * - fog: #7fb6e0, near 160, far 260
 * - shadowMap: PCFShadowMap, enabled
 * - hemi: sky #e8f6ff, ground #2f6b35, intensity 2.35
 * - sun: #fff1cb, intensity 2.4, position (-25, 42, 18), castShadow,
 *   mapSize 1024, ortho (-60, 60, 45, -45)
 */
export const HNC_RENDER_PROFILE = {
  outputColorSpace: THREE.SRGBColorSpace,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.12,
  background: '#7fb6e0',
  fogColor: '#7fb6e0',
  fogNear: 160,
  fogFar: 260,
  shadowMapEnabled: true,
  shadowMapType: THREE.PCFShadowMap,
  hemiSky: '#e8f6ff',
  hemiGround: '#2f6b35',
  hemiIntensity: 2.35,
  sunColor: '#fff1cb',
  sunIntensity: 2.4,
  sunPosition: [-25, 42, 18] as [number, number, number],
  sunShadowMapSize: 1024,
  sunShadowLeft: -60,
  sunShadowRight: 60,
  sunShadowTop: 45,
  sunShadowBottom: -45,
  // Reel lights: the old ReelComposition used ambient 0.9 + hemi 1.1 + dir 1.6
  // with `linear flat` (no tone mapping, no sRGB) — visibly washed out vs the
  // game. Reels must use the game intensities above (2.35 / 2.4).
  reelAmbientIntensity: 0 as const,
} as const;

/** Apply the canonical profile to an existing scene + renderer pair. */
export function applyHncRenderProfile(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight } {
  renderer.outputColorSpace = HNC_RENDER_PROFILE.outputColorSpace;
  renderer.toneMapping = HNC_RENDER_PROFILE.toneMapping;
  renderer.toneMappingExposure = HNC_RENDER_PROFILE.toneMappingExposure;
  renderer.shadowMap.enabled = HNC_RENDER_PROFILE.shadowMapEnabled;
  renderer.shadowMap.type = HNC_RENDER_PROFILE.shadowMapType;
  scene.background = new THREE.Color(HNC_RENDER_PROFILE.background);
  scene.fog = new THREE.Fog(
    HNC_RENDER_PROFILE.fogColor,
    HNC_RENDER_PROFILE.fogNear,
    HNC_RENDER_PROFILE.fogFar,
  );
  const hemi = new THREE.HemisphereLight(
    HNC_RENDER_PROFILE.hemiSky,
    HNC_RENDER_PROFILE.hemiGround,
    HNC_RENDER_PROFILE.hemiIntensity,
  );
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(HNC_RENDER_PROFILE.sunColor, HNC_RENDER_PROFILE.sunIntensity);
  sun.position.set(...HNC_RENDER_PROFILE.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(HNC_RENDER_PROFILE.sunShadowMapSize, HNC_RENDER_PROFILE.sunShadowMapSize);
  sun.shadow.camera.left = HNC_RENDER_PROFILE.sunShadowLeft;
  sun.shadow.camera.right = HNC_RENDER_PROFILE.sunShadowRight;
  sun.shadow.camera.top = HNC_RENDER_PROFILE.sunShadowTop;
  sun.shadow.camera.bottom = HNC_RENDER_PROFILE.sunShadowBottom;
  scene.add(sun);
  return { hemi, sun };
}

/**
 * Canonical R3F light intensities for the Reel adapter (no `linear flat`).
 * Use <hemisphereLight args> + <directionalLight> with these exact values.
 */
export const HNC_R3F_LIGHTS = {
  hemiSky: '#e8f6ff',
  hemiGround: '#2f6b35',
  hemiIntensity: 2.35,
  sunColor: '#fff1cb',
  sunIntensity: 2.4,
  sunPosition: [-25, 42, 18] as [number, number, number],
  background: '#7fb6e0',
} as const;
