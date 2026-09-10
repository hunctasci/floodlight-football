import * as THREE from 'three';
import { MatchState, Player, Team, TeamId } from './types';
import {
  CAMERA_LABELS,
  CAMERA_MODES,
  celebrationMove,
  computeCamera,
  easeInOut,
  followFocus,
  goalCineShot,
  goalCineVariant,
  menuOrbitPos,
  scorerTeam,
  type CameraFrame,
  type CameraMode,
  type GoalCineVariant,
} from './render/camera';
import { AD_H, AD_W, adForSlot, paintAd } from './render/ads';
import { crowdFanOffset, fanSection, hash01, type SocialCrowdState } from './render/crowd';
// Canonical visual identity: single source of truth lives in
// packages/hnc-visuals (extracted verbatim from this renderer). The game
// delegates geometry/material/lighting construction there so gameplay and
// Reels can never drift. Values below are re-exports, not duplicates.
import {
  CROWD_HALF_HEIGHT as CANON_CROWD_HALF_HEIGHT,
  END_STAND_ROWS as CANON_END_STAND_ROWS,
  FAR_STAND_BASE_TOP as CANON_FAR_STAND_BASE_TOP,
  FAR_STAND_BASE_Z as CANON_FAR_STAND_BASE_Z,
  FAR_STAND_RISE as CANON_FAR_STAND_RISE,
  FAR_STAND_ROW_DEPTH as CANON_FAR_STAND_ROW_DEPTH,
  FAR_STAND_ROWS as CANON_FAR_STAND_ROWS,
  HNC_RENDER_PROFILE,
  createHncBallVisual,
  createHncCrowd,
  createHncGoals,
  createHncPitch,
  createHncPlayerVisual,
  createHncStands,
  endStandFanY as canonEndStandFanY,
  endStandTerraceTop as canonEndStandTerraceTop,
  farStandFanY as canonFarStandFanY,
  farStandFanZ as canonFarStandFanZ,
  farStandTerraceTop as canonFarStandTerraceTop,
  hncBallTexture,
  hncNumberTexture,
  isStandAisle as canonIsStandAisle,
  rekitHncPlayerVisual,
} from '@floodlight/hnc-visuals';

/**
 * Visible far-stand terrace geometry (social + game share one stadium).
 *
 * The old stand was a single 9m concrete box with fans embedded inside it,
 * so low social cameras saw a giant blue wall with one strip of heads.
 * The new stand is a stepped terrace: a low fascia (~1.1m) plus 8 risers.
 * Fans stand ON the steps (base = terrace top + half fan height).
 * Pure helpers so tests can verify fans sit above concrete without a DOM.
 */
export const FAR_STAND_ROWS = CANON_FAR_STAND_ROWS;
export const FAR_STAND_BASE_TOP = CANON_FAR_STAND_BASE_TOP;
export const FAR_STAND_RISE = CANON_FAR_STAND_RISE;
/** Fan z of row 0 (front row), each row 1.1m deeper. */
export const FAR_STAND_BASE_Z = CANON_FAR_STAND_BASE_Z;
export const FAR_STAND_ROW_DEPTH = CANON_FAR_STAND_ROW_DEPTH;
export const END_STAND_ROWS = CANON_END_STAND_ROWS;
/** Half height of the crowd box (1.05 x 0.72 x 0.55): base sits 0.36 above the step. */
export const CROWD_HALF_HEIGHT = CANON_CROWD_HALF_HEIGHT;

export function farStandTerraceTop(row: number): number {
  return canonFarStandTerraceTop(row);
}
export function farStandFanY(row: number): number {
  return canonFarStandFanY(row);
}
export function farStandFanZ(row: number): number {
  return canonFarStandFanZ(row);
}
export function endStandTerraceTop(row: number): number {
  return canonEndStandTerraceTop(row);
}
export function endStandFanY(row: number): number {
  return canonEndStandFanY(row);
}
/** Centre aisle (section split home/away) + two side aisles. */
export function isStandAisle(x: number): boolean {
  return canonIsStandAisle(x);
}

// Backwards-compatible re-exports: canonical pure camera math lives in
// render/camera.ts; existing tests import from here.
export {
  CAMERA_LABELS,
  CAMERA_MODES,
  celebrationMove,
  computeCamera,
  easeInOut,
  followFocus,
  goalCineShot,
  goalCineVariant,
  menuOrbitPos,
  scorerTeam,
  type CameraFrame,
  type CameraMode,
  type GoalCineVariant,
};

type Avatar = { root: THREE.Group; body: THREE.Mesh; head: THREE.Mesh; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh; shadow: THREE.Mesh; kit: THREE.Color; trim: THREE.Color; keeper: boolean; kitParts: THREE.Mesh[]; trimParts: THREE.Mesh[] };

/** Shared white-on-transparent shirt numbers 1..11 (canonical cache). */
function numberTexture(n: number): THREE.CanvasTexture | THREE.DataTexture {
  return hncNumberTexture(n);
}

/** Interpolated display positions from the app loop (prev-tick lerp). */
export interface DisplayPositions {
  px: Float32Array; pz: Float32Array; bx: number; by: number; bz: number;
}

/**
 * Optional renderer sizing. Omitted = legacy game behavior (container/window
 * size, capped device pixel ratio). Social export passes an exact buffer so
 * stills never depend on `innerWidth`/`devicePixelRatio`.
 */
export interface RendererOptions {
  mode?: 'game' | 'social';
  width?: number;
  height?: number;
  pixelRatio?: number;
}

/** Fixed lens for a deterministic social still (built by a semantic preset). */
export interface SocialCameraPose {
  pos: { x: number; y: number; z: number };
  look: { x: number; y: number; z: number };
  fov: number;
}

/**
 * Micro-pose for one social avatar, evaluated by the timeline (breathing,
 * lean, arm lift, stride, dive roll, celebration spin). All zeros = neutral
 * idle, identical to stills without a pose. The renderer only applies final
 * values — it knows no time or frames.
 */
export interface SocialActorPose {
  /** Vertical root offset in metres. */
  bob: number;
  /** Forward lean in radians. */
  lean: number;
  /** Symmetric arm raise in radians (0 = relaxed at the sides). */
  armLift: number;
  /** Stride swing in radians (left leg forward, right leg back). */
  legSwing?: number;
  /** Symmetric arm spread in radians (dive reach, spin celebration). */
  armSpread?: number;
  /** Lateral body roll in radians (keeper dive). */
  roll?: number;
  /** Extra yaw in radians added to the facing (spin celebration). */
  spin?: number;
}

/** Deterministic ball-trail segment staged by the timeline. */
export interface SocialBallTrail {
  fromX: number;
  fromY: number;
  fromZ: number;
  /** 0 = hidden, 1 = full trail from `from` to the ball. */
  intensity: number;
}

/**
 * Deterministic social effects, evaluated by the timeline like everything
 * else. All values are final per-frame amounts — no accumulation, no history,
 * no randomness — so any frame renders identically in any process.
 */
export interface SocialEffects {
  /** Shot trail along the from→ball segment. */
  trail?: SocialBallTrail;
  /** FOV reduction in degrees (shot punch). */
  fovPunch?: number;
  /** Absolute camera offset in metres (timeline-computed deterministic shake). */
  shakeX?: number;
  /** Absolute camera offset in metres (timeline-computed deterministic shake). */
  shakeY?: number;
}

type Cine = { type: 'goal' | 'intro'; t: number; dur: number; side: number; variant: GoalCineVariant; fromPos: THREE.Vector3; fromLook: THREE.Vector3 } | null;

/** Classic pentagon ball skin — canonical shared texture. */
function ballTexture(): THREE.CanvasTexture | THREE.DataTexture {
  return hncBallTexture();
}

/** Deliberately chunky, inexpensive match renderer.  All art is made from geometry. */
export class GameRenderer {
  public canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, .1, 280);
  private renderer: THREE.WebGLRenderer;
  private avatars: Avatar[] = [];
  private ball: THREE.Group;
  private ballShadow: THREE.Mesh;
  private marker: THREE.Mesh;
  private arrow: THREE.Mesh;
  private target: THREE.Mesh;
  private goalNets: THREE.Group[] = [];
  private standBanners: THREE.Mesh[] = [];
  private camLook = new THREE.Vector3();
  private camPos = new THREE.Vector3(0, 29, 38);
  private clock = 0;
  private lastFlight = 'roll';
  private shake = 0;
  private cameraMode: CameraMode = 'broadcast';
  private lastPhase = '';
  private cine: Cine = null;
  // Goal-celebration tracking: scoreboard delta reveals the scoring team,
  // whose outfield players celebrate for the whole goal phase (visual only).
  private lastScore: [number, number] = [0, 0];
  private celeTeam: TeamId | null = null;
  private menuAngle = 0;
  private endAngle = 0;
  private trail: THREE.Mesh[] = [];
  private trailAge: number[] = [];
  private trailTick = 0;
  private fovPunch = 0;
  /** Exact export buffer for social stills; null = legacy game sizing. */
  private fixedSize: { w: number; h: number; pr: number } | null = null;
  /** True for social-export renderers (exact buffer + social-only dressing). */
  private socialMode = false;
  /** All crowd instances with their deterministic build-time base transforms. */
  private crowdMeshes: THREE.InstancedMesh[] = [];
  private crowdBase: { mesh: THREE.InstancedMesh; i: number; index: number; x: number; y: number; z: number; row: number; origColor: string }[] = [];
  /** Social-only stand dressing (team section banners + flags), built lazily. */
  private crowdDressing: {
    key: string;
    sectionL: THREE.Mesh;
    sectionR: THREE.Mesh;
    flags: THREE.Mesh[];
  } | null = null;
  /** Reused temps so per-frame crowd updates never allocate. */
  private crowdTmpM = new THREE.Matrix4();
  private crowdTmpP = new THREE.Vector3();
  private crowdTmpQ = new THREE.Quaternion();
  private crowdTmpS = new THREE.Vector3();

  /** Shot impact juice: power-scaled camera shake + quick fov punch. */
  impact(power: number) {
    this.shake = Math.max(this.shake, Math.min(.55, .16 + power * .01));
    this.fovPunch = Math.min(3.5, power * .09);
  }

  cycleCamera(): CameraMode {
    this.cameraMode = CAMERA_MODES[(CAMERA_MODES.indexOf(this.cameraMode) + 1) % CAMERA_MODES.length];
    return this.cameraMode;
  }
  cameraLabel(): string { return CAMERA_LABELS[this.cameraMode]; }
  /**
   * Online view override: follow a specific player/target instead of the
   * local controlled pair (e.g. team-1 client follows peerControlled).
   * Pass nulls to return to the default local view.
   */
  setFollow(id: number | null, target: number | null) {
    this.followId = id; this.followTargetId = target;
  }
  private followId: number | null = null;
  private followTargetId: number | null = null;
  /** True while a letterboxed cinematic (goal replay sweep) owns the lens. */
  inCinematic(): boolean { return this.cine?.type === 'goal'; }

  constructor(container: HTMLElement, opts: RendererOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.socialMode = opts.mode === 'social';
    if (opts.width !== undefined && opts.height !== undefined) {
      this.fixedSize = { w: opts.width, h: opts.height, pr: opts.pixelRatio ?? 1 };
    }
    this.renderer.setPixelRatio(this.fixedSize ? this.fixedSize.pr : Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(
      this.fixedSize ? this.fixedSize.w : (container.clientWidth || innerWidth),
      this.fixedSize ? this.fixedSize.h : (container.clientHeight || innerHeight),
    );
    this.renderer.shadowMap.enabled = HNC_RENDER_PROFILE.shadowMapEnabled;
    this.renderer.shadowMap.type = HNC_RENDER_PROFILE.shadowMapType;
    this.renderer.outputColorSpace = HNC_RENDER_PROFILE.outputColorSpace;
    this.renderer.toneMapping = HNC_RENDER_PROFILE.toneMapping;
    this.renderer.toneMappingExposure = HNC_RENDER_PROFILE.toneMappingExposure;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'match-canvas';
    container.appendChild(this.canvas);
    this.scene.background = new THREE.Color(HNC_RENDER_PROFILE.background);
    this.scene.fog = new THREE.Fog(HNC_RENDER_PROFILE.fogColor, HNC_RENDER_PROFILE.fogNear, HNC_RENDER_PROFILE.fogFar);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(HNC_RENDER_PROFILE.hemiSky, HNC_RENDER_PROFILE.hemiGround, HNC_RENDER_PROFILE.hemiIntensity); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(HNC_RENDER_PROFILE.sunColor, HNC_RENDER_PROFILE.sunIntensity); sun.position.set(...HNC_RENDER_PROFILE.sunPosition); sun.castShadow = true;
    sun.shadow.mapSize.set(HNC_RENDER_PROFILE.sunShadowMapSize, HNC_RENDER_PROFILE.sunShadowMapSize); sun.shadow.camera.left = HNC_RENDER_PROFILE.sunShadowLeft; sun.shadow.camera.right = HNC_RENDER_PROFILE.sunShadowRight; sun.shadow.camera.top = HNC_RENDER_PROFILE.sunShadowTop; sun.shadow.camera.bottom = HNC_RENDER_PROFILE.sunShadowBottom; this.scene.add(sun);
    this.buildWorld();
    // Canonical ball (radius + pentagon texture + shadow from hnc-visuals).
    const ballVisual = createHncBallVisual();
    this.ball = ballVisual.root;
    // Reuse the shared leather texture path (identical to the old inline
    // ballTexture()); the visual already carries the canonical material.
    void ballTexture();
    this.scene.add(this.ball);
    this.ballShadow = ballVisual.shadow;
    this.scene.add(this.ballShadow);
    // Shot trail: short ring of fading puffs shown while the ball flies fast.
    const puff = new THREE.SphereGeometry(.14, 8, 6);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(puff, new THREE.MeshBasicMaterial({ color: '#f8efdb', transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; this.scene.add(m); this.trail.push(m); this.trailAge.push(1);
    }
    this.marker = new THREE.Mesh(new THREE.RingGeometry(.72, .88, 24), new THREE.MeshBasicMaterial({ color: '#35f8f0', side: THREE.DoubleSide, transparent: true, opacity: .96 }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = .025; this.scene.add(this.marker);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(.28, .68, 4), new THREE.MeshBasicMaterial({ color: '#fff253' })); this.scene.add(this.arrow);
    this.target = new THREE.Mesh(new THREE.RingGeometry(.33, .40, 16), new THREE.MeshBasicMaterial({ color: '#fff253', transparent: true, opacity: .72, side: THREE.DoubleSide })); this.target.rotation.x = -Math.PI / 2; this.target.position.y = .03; this.scene.add(this.target);
    this.resize(); addEventListener('resize', () => this.resize());
  }

  private buildWorld() {
    // Canonical stadium assembly (pitch + goals + stands + crowd). Geometry
    // and materials live in @floodlight/hnc-visuals; this method only mounts
    // them and wires game-owned handles (goalNets, crowdBase, boards).
    const pitch = createHncPitch();
    this.scene.add(pitch);
    this.buildGoals();
    this.buildStands();
  }

  private buildGoals() {
    const goals = createHncGoals();
    for (const goal of goals) {
      this.goalNets.push(goal);
      this.scene.add(goal);
    }
  }

  private buildStands() {
    // Canonical stands + crowd + floodlights. The ad-board painter injects
    // the game's LinkedIn/GitHub canvas creatives for full parity.
    const makeAd = (slot: number): THREE.Material => {
      const ad = adForSlot(slot);
      const c = document.createElement('canvas'); c.width = AD_W; c.height = AD_H;
      paintAd(c.getContext('2d')!, ad, AD_W, AD_H);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return new THREE.MeshBasicMaterial({ map: tex });
    };
    const stands = createHncStands(makeAd);
    this.scene.add(stands.group);
    // Two alternating creatives; boards alternate slots 0/1 in build order.
    void stands;
    const crowd = createHncCrowd();
    for (const mesh of crowd.meshes) {
      this.crowdMeshes.push(mesh);
      this.scene.add(mesh);
    }
    for (const b of crowd.base) this.crowdBase.push(b);
    // (No giant end boxes: low terraces above replace them so goal-mouth
    // cameras see supporters + sky instead of flat concrete.)
  }

  /** Flat retro supporter flag texture: team colour, cream border, navy-cut label. */
  private flagTexture(label: string, bg: string): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#f8efdb'; ctx.lineWidth = 10; ctx.strokeRect(6, 6, 244, 116);
    let size = 44;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const font = (s: number) => `bold ${s}px Impact, 'Arial Black', sans-serif`;
    ctx.font = font(size);
    while (ctx.measureText(label).width > 200 && size > 18) { size -= 4; ctx.font = font(size); }
    ctx.lineWidth = 7; ctx.strokeStyle = '#101b31'; ctx.strokeText(label, 128, 66);
    ctx.fillStyle = '#f8efdb'; ctx.fillText(label, 128, 66);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Social-only stand dressing: two team-colour section banners splitting
   * the far-stand fascia into home (left) / away (right) supporter regions,
   * three flat supporter flags, plus per-instance supporter section tinting
   * (left fans wear home-biased colours, right fans away-biased). Built once
   * per matchup; never in game mode, so live gameplay renders exactly as
   * before. Tinting is a pure function of (index, matchup) — random-access
   * safe, no per-frame state.
   */
  private ensureSocialDressing(home: Team, away: Team): void {
    if (!this.socialMode) return;
    const key = `${home.color}|${away.color}|${home.name}|${away.name}`;
    if (this.crowdDressing) {
      if (this.crowdDressing.key === key) return;
      (this.crowdDressing.sectionL.material as THREE.MeshBasicMaterial).color.set(home.color);
      (this.crowdDressing.sectionR.material as THREE.MeshBasicMaterial).color.set(away.color);
      this.applySectionTint(home, away);
      this.crowdDressing.key = key;
      return;
    }
    // Section banners mount on the first-riser face (riser 0 spans y 1.1..1.5,
    // front face z=-31.35): a team-colour strip just above the ad boards,
    // never hiding supporters. The fascia itself stays plain concrete.
    const sectionGeo = new THREE.PlaneGeometry(52, 0.36);
    const sectionL = new THREE.Mesh(sectionGeo, new THREE.MeshBasicMaterial({ color: home.color }));
    sectionL.position.set(-26, 1.32, -31.33);
    const sectionR = new THREE.Mesh(sectionGeo, new THREE.MeshBasicMaterial({ color: away.color }));
    sectionR.position.set(26, 1.32, -31.33);
    this.scene.add(sectionL, sectionR);
    const flagGeo = new THREE.PlaneGeometry(4, 1.8);
    const defs = [
      { label: home.name.toUpperCase(), bg: home.color, x: -30 },
      { label: 'HNC LEAGUE', bg: '#101b31', x: 0 },
      { label: away.name.toUpperCase(), bg: away.color, x: 30 },
    ];
    const flags = defs.map((d, i) => {
      const f = new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ map: this.flagTexture(d.label, d.bg), side: THREE.DoubleSide }));
      // Supporter-held banners tucked among the mid rows (fans reach y≈5.9,
      // roof underside is y≈6.95): visible above the crowd, never floating.
      // The centre HNC flag fills the middle aisle gap.
      f.position.set(d.x, 4.9, -37.0);
      f.userData.baseY = 4.9;
      f.userData.phase = i * 2.1;
      this.scene.add(f);
      return f;
    });
    this.crowdDressing = { key, sectionL, sectionR, flags };
    this.applySectionTint(home, away);
  }

  /**
   * Tint crowd instances into home/away sections: ~62% wear their side's
   * team colour (with deterministic lightness variation), ~18% neutrals,
   * the rest keep the mosaic pop. Game mode never calls this (mosaic kept).
   */
  private applySectionTint(home: Team, away: Team): void {
    const c = new THREE.Color();
    for (const b of this.crowdBase) {
      // End-stand fans keep the neutral mosaic (sections read on the far stand).
      const isFar = Math.abs(b.x) < 50;
      if (!isFar) {
        c.set(b.origColor);
        b.mesh.setColorAt(b.i, c);
        continue;
      }
      const side = fanSection(b.x);
      const teamHex = side === 0 ? home.color : away.color;
      const h = hash01(b.index * 3 + 7, 11);
      if (h < 0.62) {
        c.set(teamHex);
        c.offsetHSL(0, (hash01(b.index, 5) - 0.5) * 0.1, (hash01(b.index, 9) - 0.5) * 0.12);
      } else if (h < 0.8) {
        c.set(hash01(b.index, 13) < 0.5 ? '#f3ede0' : '#1d3346');
      } else {
        c.set(b.origColor);
      }
      b.mesh.setColorAt(b.i, c);
    }
    for (const mesh of this.crowdMeshes) {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Social-only crowd choreography: rewrites crowd instance matrices from
   * the final evaluated crowd state (mood/intensity chosen by scene code).
   * Pure per-frame function of the state — no accumulation, no randomness —
   * so any frame renders identically standalone. The game `render()` path
   * never calls this; live crowds stay exactly as built.
   */
  private applySocialCrowd(crowd: SocialCrowdState, teams: [Team, Team]): void {
    this.ensureSocialDressing(teams[0], teams[1]);
    for (const b of this.crowdBase) {
      const o = crowdFanOffset({ x: b.x, row: b.row, index: b.index }, crowd);
      // End-stand perceptual scale: goal-mouth closeups sit metres from the
      // end terraces, so full-size boxes read oversized. End fans render at
      // 0.85 scale, pushed 0.6m deeper with an extra row-friendly offset —
      // structural (all cameras), never a per-camera special case.
      const isEnd = Math.abs(b.x) > 50;
      const s = isEnd ? 0.85 : 1;
      this.crowdTmpP.set(b.x + (isEnd ? Math.sign(b.x) * 0.6 : 0), b.y + o.dy, b.z + o.dz);
      this.crowdTmpQ.identity();
      this.crowdTmpS.set(s, o.sy * s, s);
      this.crowdTmpM.compose(this.crowdTmpP, this.crowdTmpQ, this.crowdTmpS);
      b.mesh.setMatrixAt(b.i, this.crowdTmpM);
    }
    for (const mesh of this.crowdMeshes) mesh.instanceMatrix.needsUpdate = true;
    if (this.crowdDressing) {
      // Deterministic flag bob: slightly livelier during eruptions.
      const k = 0.4 + 0.6 * Math.min(1, Math.max(0, crowd.intensity));
      for (const f of this.crowdDressing.flags) {
        const ph = f.userData.phase as number;
        f.position.y = (f.userData.baseY as number) + Math.sin(crowd.time * 2.4 + ph) * 0.14 * k;
        f.rotation.z = Math.sin(crowd.time * 2.0 + ph * 0.8) * 0.05 * k;
      }
    }
  }

  private makeAvatar(p: Player, state: MatchState): Avatar {
    // Canonical HNC character — geometry/materials owned by hnc-visuals.
    // Extraction refactor: identical look, zero gameplay change.
    const visual = createHncPlayerVisual({
      id: p.id,
      number: p.number,
      primary: state.teams[p.team].color,
      secondary: state.teams[p.team].secondary,
      keeper: p.keeper,
    });
    this.scene.add(visual.root);
    this.scene.add(visual.shadow);
    // Touch the shared number-texture cache so behaviour (and tests around
    // caching) stays identical to the old inline implementation.
    void numberTexture(p.number);
    return {
      root: visual.root,
      body: visual.body,
      head: visual.head,
      legL: visual.legL,
      legR: visual.legR,
      armL: visual.armL,
      armR: visual.armR,
      shadow: visual.shadow,
      kit: visual.kit,
      trim: visual.trim,
      keeper: visual.keeper,
      kitParts: visual.kitParts,
      trimParts: visual.trimParts,
    };
  }

  private ensureAvatars(state: MatchState) {
    while (this.avatars.length < state.players.length) this.avatars.push(this.makeAvatar(state.players[this.avatars.length], state));
    state.players.forEach((p,i)=>{
      const a=this.avatars[i];
      const kit=p.keeper?'#6b64d9':state.teams[p.team].color, trim=state.teams[p.team].secondary;
      rekitHncPlayerVisual(
        { root: a.root, body: a.body, head: a.head, legL: a.legL, legR: a.legR, armL: a.armL, armR: a.armR, shadow: a.shadow, kit: a.kit, trim: a.trim, keeper: a.keeper, kitParts: a.kitParts, trimParts: a.trimParts, extras: [] },
        kit,
        trim,
      );
    });
    // Each side stand flies one club's colours.
    this.standBanners.forEach((b, i) => (b.material as THREE.MeshBasicMaterial).color.set(state.teams[i % 2].color));
  }

  /** Follow target: tracks the ball tightly so sidelines stay near frame centre. */
  private followFrame(state: MatchState, disp: DisplayPositions | null): CameraFrame {
    const cp = state.players[this.followId ?? state.controlled];
    const bx = disp ? disp.bx : state.ball.x, bz = disp ? disp.bz : state.ball.z;
    const f = followFocus(bx, bz, cp?.x || 0, cp?.z || 0);
    return computeCamera(this.cameraMode, this.camera.aspect, f.x, f.z);
  }

  private applyFrame(frame: CameraFrame, dt: number, stiff = false) {
    if (this.camera.fov !== frame.fov) { this.camera.fov = frame.fov; this.camera.updateProjectionMatrix(); }
    const kp = 1 - Math.exp(-dt * (stiff ? 8 : 3)), kl = 1 - Math.exp(-dt * (stiff ? 8 : 4));
    this.camPos.lerp(frame.pos, kp); this.camLook.lerp(frame.look, kl);
  }

  private startCine(state: MatchState, type: 'goal' | 'intro', dur: number) {
    const side = Math.sign(state.ball.x) || 1;
    this.cine = {
      type, t: 0, dur, side,
      variant: type === 'goal' ? goalCineVariant(side, state.ball.x, state.ball.z) : 0,
      fromPos: this.camPos.clone(), fromLook: this.camLook.clone(),
    };
  }

  /** Goal-phase celebration pose for scoring-team players (visual only). */
  private celebrate(a: Avatar, i: number, p: Player, state: MatchState) {
    // Spread arms reset every frame: only the spinner holds them out.
    a.armL.rotation.z = 0; a.armR.rotation.z = 0;
    if (state.phase !== 'goal' || this.celeTeam === null || p.team !== this.celeTeam) return;
    const move = celebrationMove(i, p.keeper);
    a.legL.rotation.x = 0; a.legR.rotation.x = 0;
    if (move === 0) {
      // Jump with both arms up.
      a.root.position.y = Math.abs(Math.sin(this.clock * 7 + i * 1.3)) * .75;
      a.armL.rotation.x = -2.5; a.armR.rotation.x = -2.5;
    } else if (move === 1) {
      // Spin with arms spread wide.
      a.root.rotation.y += (this.clock * 4.5 + i) % (Math.PI * 2);
      a.armL.rotation.x = 0; a.armR.rotation.x = 0;
      a.armL.rotation.z = 1.5; a.armR.rotation.z = -1.5;
    } else {
      // Lean-back knee-slide stance with a bounce.
      a.root.position.y = Math.abs(Math.sin(this.clock * 5 + i)) * .18;
      a.root.rotation.x = -.45;
      a.armL.rotation.x = -2.2; a.armR.rotation.x = -2.2;
    }
  }

  private updateGoalCine(state: MatchState, dt: number) {
    const c = this.cine; if (!c) return;
    c.t += dt;
    const ease = easeInOut(c.t / c.dur);
    const end = goalCineShot(c.variant, c.side, state.ball.x, state.ball.z);
    const pos = c.fromPos.clone().lerp(end.pos, ease), look = c.fromLook.clone().lerp(end.look, ease);
    if (this.camera.fov !== 38) { this.camera.fov = 38; this.camera.updateProjectionMatrix(); }
    this.camPos.lerp(pos, 1 - Math.exp(-dt * 8)); this.camLook.lerp(look, 1 - Math.exp(-dt * 8));
    if (c.t >= c.dur) this.cine = null;
  }

  private updateIntroCine(state: MatchState, dt: number) {
    const c = this.cine; if (!c) return;
    // Kickoff taken early cancels the sweep straight into the follow cam.
    if (state.phase !== 'kickoff') { this.cine = null; return; }
    c.t += dt;
    const ease = easeInOut(c.t / c.dur);
    const end = this.followFrame(state, null);
    // Kickoff sweep starts over one end so consecutive matches open differently.
    const high = new THREE.Vector3(c.side * 18, 58, -6);
    const pos = high.lerp(end.pos, ease);
    if (this.camera.fov !== end.fov) { this.camera.fov = end.fov; this.camera.updateProjectionMatrix(); }
    this.camPos.lerp(pos, 1 - Math.exp(-dt * 6)); this.camLook.lerp(end.look, 1 - Math.exp(-dt * 6));
    if (c.t >= c.dur) this.cine = null;
  }

  render(state: MatchState, dt: number, menu = false, disp: DisplayPositions | null = null) {
    this.clock += Math.min(dt,.05); this.ensureAvatars(state);
    // Display positions: interpolated sim state when provided, raw otherwise.
    const PX = (i: number) => (disp && i < disp.px.length ? disp.px[i] : state.players[i].x);
    const PZ = (i: number) => (disp && i < disp.pz.length ? disp.pz[i] : state.players[i].z);
    const BX = disp ? disp.bx : state.ball.x, BY = disp ? disp.by : state.ball.y, BZ = disp ? disp.bz : state.ball.z;
    if (state.score[0] !== this.lastScore[0] || state.score[1] !== this.lastScore[1]) {
      this.celeTeam = scorerTeam(this.lastScore, state.score);
      this.lastScore = [state.score[0], state.score[1]];
    }
    const ball = state.ball; if(ball.flight==='shot'&&this.lastFlight!=='shot')this.shake=.22;this.lastFlight=ball.flight;this.shake=Math.max(0,this.shake-dt*.9);this.fovPunch=Math.max(0,this.fovPunch-dt*10);
    // Fast airborne ball leaves a fading trail of puffs behind it.
    const ballSpeed=Math.hypot(ball.vx,ball.vz); this.trailTick+=dt;
    if(ballSpeed>18){ if(this.trailTick>.028){this.trailTick=0;const m=this.trail.shift()!;this.trail.push(m);m.visible=true;m.position.set(ball.x,Math.max(.2,ball.y),ball.z);this.trailAge.push(0);this.trailAge.shift();}
      for(let i=0;i<this.trail.length;i++){const age=this.trailAge[i]+dt*2.6;this.trailAge[i]=Math.min(1,age);const mat=this.trail[i].material as THREE.MeshBasicMaterial;mat.opacity=.4*(1-this.trailAge[i]);this.trail[i].scale.setScalar(1+this.trailAge[i]*1.6);if(this.trailAge[i]>=1)this.trail[i].visible=false;}
    } else for(const m of this.trail){this.trailAge[this.trail.indexOf(m)]=1;m.visible=false;}
    this.ball.position.set(BX, Math.max(.25,BY), BZ); this.ball.rotation.x += ball.vz * dt * 2; this.ball.rotation.z -= ball.vx * dt * 2; this.ballShadow.position.set(BX,.015,BZ); this.ballShadow.scale.setScalar(1 + Math.min(1,BY)*.45);
    state.players.forEach((p,i) => { const a=this.avatars[i], speed=Math.hypot(p.vx,p.vz), ex=PX(i), ez=PZ(i); a.root.position.set(ex,0,ez); a.root.rotation.set(0,Math.atan2(p.facingX,p.facingZ),0); const run=p.action==='run'||speed>1; const swing=run?Math.sin(this.clock*(8+speed*1.5)+i)*Math.min(.85,.22+speed*.12):0; a.legL.rotation.x=swing;a.legR.rotation.x=-swing;a.armL.rotation.x=-swing*.72;a.armR.rotation.x=swing*.72; if(p.action==='kick'){a.legR.rotation.x=-1.35*Math.min(1,p.actionTime*9)} if(p.action==='tackle'){a.root.rotation.z=.32*Math.sin(Math.min(1,p.actionTime*5))} if(p.action==='slide'){a.root.rotation.x=-.95*Math.min(1,p.actionTime*4.5);a.root.position.y=.13;a.legR.rotation.x=-1.25;a.legL.rotation.x=-.4;a.armL.rotation.x=.9;a.armR.rotation.x=-.9} if(p.action==='fallen'){const rise=1-Math.min(1,p.actionTime/.75);a.root.rotation.x=-1.4*(1-rise*rise);a.root.position.y=.09*(1-rise);a.legL.rotation.x=a.legR.rotation.x=a.armL.rotation.x=a.armR.rotation.x=-.25} if(p.action==='dive'){a.root.rotation.z=p.facingZ*.95;a.root.rotation.x=-p.facingX*.55;a.root.position.y=.26} else if(p.action!=='slide'&&p.action!=='fallen')a.root.position.y=0; this.celebrate(a,i,p,state); a.shadow.position.set(ex,.015,ez); a.shadow.scale.setScalar(p.action==='dive'?1.45:1); });
    const cpi=this.followId ?? state.controlled, cp=state.players[cpi]; if(cp){this.marker.visible=!menu;this.arrow.visible=!menu;this.marker.position.set(PX(cpi),.03,PZ(cpi));this.arrow.position.set(PX(cpi),2.65+Math.sin(this.clock*5)*.08,PZ(cpi));this.arrow.rotation.x=Math.PI;}
    const tid=this.followTargetId ?? state.targetPlayer;const tp=tid===null?null:state.players[tid];this.target.visible=!!tp&&!menu;if(tp)this.target.position.set(PX(tid as number),.04,PZ(tid as number));
    if (state.phase !== this.lastPhase) {
      const prev = this.lastPhase; this.lastPhase = state.phase;
      if (state.phase === 'goal' && prev !== 'goal') this.startCine(state, 'goal', 2.7);
      else if (state.phase === 'kickoff' && state.time < 2) this.startCine(state, 'intro', 3);
    }
    if (menu) {
      // Title/team backdrop: slow showcase orbit around the stadium.
      this.cine = null; this.menuAngle += dt * .07;
      if (this.camera.fov !== 42) { this.camera.fov = 42; this.camera.updateProjectionMatrix(); }
      const pos = menuOrbitPos(this.menuAngle);
      this.camPos.lerp(pos, 1 - Math.exp(-dt * 2)); this.camLook.lerp(new THREE.Vector3(0, 1, 0), 1 - Math.exp(-dt * 2));
    } else if (this.cine?.type === 'goal') this.updateGoalCine(state, dt);
    else if (this.cine?.type === 'intro') this.updateIntroCine(state, dt);
    else if (state.paused || state.phase === 'halftime' || state.phase === 'fulltime') {
      // Pause/half/full-time: gentle orbit around the current view.
      this.endAngle += dt * .12;
      const r = 40, look = this.camLook.clone();
      const pos = new THREE.Vector3(look.x + Math.sin(this.endAngle) * r, look.y + 26, look.z + Math.cos(this.endAngle) * r);
      if (this.camera.fov !== 42) { this.camera.fov = 42; this.camera.updateProjectionMatrix(); }
      this.camPos.lerp(pos, 1 - Math.exp(-dt * 1.5));
    } else this.applyFrame(this.followFrame(state, disp), dt);
    this.camera.position.copy(this.camPos);
    if(this.shake>0)this.camera.position.add(new THREE.Vector3(Math.sin(this.clock*55)*this.shake,Math.cos(this.clock*71)*this.shake*.45,0));this.camera.lookAt(this.camLook);
    if(this.fovPunch>0){this.camera.fov=Math.max(20,this.camera.fov-this.fovPunch);this.camera.updateProjectionMatrix();}
    for (const g of this.goalNets) {
      const side=g.userData.side as number; const scored=state.phase==='goal'&&Math.sign(ball.x)===Math.sign(side); const net=g.getObjectByName('net');
      if(net){const pulse=scored?Math.sin(Math.min(1,state.phaseTime)*Math.PI)*.22:0;net.position.x=Math.sign(side)*pulse;}
    }
    this.renderer.render(this.scene,this.camera);
  }

  /**
   * Deterministic social still: stages the given state with a fixed lens, a
   * frozen animation clock, no HUD markers, no ball trail, no shake and no
   * camera easing. The optional per-actor pose stages timeline micro-motion
   * (breathing/lean/arms); omitted = neutral idle. The optional crowd state
   * stages social-only supporter choreography (idle/wave/anticipation/goal);
   * omitted = the static built crowd, identical to the game. The live-game
   * `render()` path above is untouched.
   */
  renderSocial(state: MatchState, cam: SocialCameraPose, clockFixed = 1.0, pose?: SocialActorPose[], effects?: SocialEffects, crowd?: SocialCrowdState): void {
    this.clock = clockFixed;
    this.shake = 0; this.fovPunch = 0; this.cine = null;
    this.lastFlight = state.ball.flight;
    this.ensureAvatars(state);
    const ball = state.ball;
    this.ball.position.set(ball.x, Math.max(.25, ball.y), ball.z);
    this.ball.rotation.set(0, 0, 0);
    this.ballShadow.position.set(ball.x, .015, ball.z);
    this.ballShadow.scale.setScalar(1 + Math.min(1, ball.y) * .45);
    state.players.forEach((p, i) => {
      const a = this.avatars[i];
      const mp = pose?.[i] ?? { bob: 0, lean: 0, armLift: 0 };
      const swing = mp.legSwing ?? 0, spread = mp.armSpread ?? 0;
      a.root.position.set(p.x, mp.bob, p.z);
      a.root.rotation.set(-mp.lean, Math.atan2(p.facingX, p.facingZ) + (mp.spin ?? 0), mp.roll ?? 0);
      a.legL.rotation.x = swing; a.legR.rotation.x = -swing;
      a.armL.rotation.x = -mp.armLift - swing * .5; a.armR.rotation.x = -mp.armLift + swing * .5;
      a.armL.rotation.z = spread; a.armR.rotation.z = -spread;
      a.shadow.position.set(p.x, .015, p.z);
      a.shadow.scale.setScalar(1);
    });
    this.marker.visible = false; this.arrow.visible = false; this.target.visible = false;
    const fx = effects ?? {};
    const trail = fx.trail;
    if (trail && trail.intensity > 0) {
      // Deterministic restaging of the pooled puffs along from→ball.
      const n = this.trail.length;
      for (let i = 0; i < n; i++) {
        const m = this.trail[i], k = n > 1 ? i / (n - 1) : 0;
        const fade = (1 - k) * trail.intensity;
        m.visible = fade > 0.01;
        m.position.set(
          trail.fromX + (ball.x - trail.fromX) * k,
          Math.max(.2, trail.fromY + (Math.max(.25, ball.y) - trail.fromY) * k),
          trail.fromZ + (ball.z - trail.fromZ) * k,
        );
        (m.material as THREE.MeshBasicMaterial).opacity = .4 * fade;
        m.scale.setScalar(1 + k * 1.6);
      }
    } else for (const m of this.trail) m.visible = false;
    this.camPos.set(cam.pos.x, cam.pos.y, cam.pos.z);
    this.camLook.set(cam.look.x, cam.look.y, cam.look.z);
    const fov = Math.max(20, cam.fov - (fx.fovPunch ?? 0));
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.camera.position.copy(this.camPos);
    if (fx.shakeX || fx.shakeY) this.camera.position.add(new THREE.Vector3(fx.shakeX ?? 0, fx.shakeY ?? 0, 0));
    this.camera.lookAt(this.camLook);
    for (const g of this.goalNets) {
      const net = g.getObjectByName('net');
      if (net) net.position.x = 0;
    }
    if (crowd) this.applySocialCrowd(crowd, state.teams);
    this.renderer.render(this.scene, this.camera);
  }
  resize(){
    if (this.fixedSize) {
      // Social export: exact buffer, never the window size.
      this.renderer.setPixelRatio(this.fixedSize.pr);
      this.camera.aspect = this.fixedSize.w / this.fixedSize.h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.fixedSize.w, this.fixedSize.h);
      return;
    }
    // NOTE: updateStyle must stay enabled. With `false`, high-DPI screens keep
    // a canvas buffer larger than its CSS box, so the frame overflows and the
    // near touchline slides out of view as resolution scales up.
    const parent=this.canvas.parentElement;const w=parent?.clientWidth||innerWidth,h=parent?.clientHeight||innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);
  }
  dispose(){this.renderer.dispose();this.canvas.remove();}
}
