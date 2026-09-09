import * as THREE from 'three';
import { FIELD, MatchState, Player, TeamId } from './types';
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

/** Shared white-on-transparent shirt numbers 1..11 (one small canvas each). */
const numberTextures = new Map<number, THREE.CanvasTexture>();
function numberTexture(n: number): THREE.CanvasTexture {
  let tex = numberTextures.get(n);
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = '#182230'; ctx.strokeText(String(n), 32, 34);
  ctx.fillStyle = '#ffffff'; ctx.fillText(String(n), 32, 34);
  tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  numberTextures.set(n, tex);
  return tex;
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

type Cine = { type: 'goal' | 'intro'; t: number; dur: number; side: number; variant: GoalCineVariant; fromPos: THREE.Vector3; fromLook: THREE.Vector3 } | null;

/** Classic pentagon ball skin painted once onto a shared canvas texture. */
let ballSkin: THREE.CanvasTexture | null = null;
function ballTexture(): THREE.CanvasTexture {
  if (ballSkin) return ballSkin;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f7f3e9'; ctx.fillRect(0, 0, 256, 128);
  const pentagon = (x: number, y: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fillStyle = '#1f3040'; ctx.fill();
  };
  // Fixed spots read as a football from every broadcast angle.
  [[32, 32, 15], [96, 88, 16], [160, 30, 15], [224, 92, 16], [64, 104, 11], [192, 108, 11], [128, 60, 12], [0, 64, 12], [256, 64, 12]].forEach(([x, y, r]) => pentagon(x, y, r));
  ballSkin = new THREE.CanvasTexture(c); ballSkin.colorSpace = THREE.SRGBColorSpace;
  return ballSkin;
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
    if (opts.width !== undefined && opts.height !== undefined) {
      this.fixedSize = { w: opts.width, h: opts.height, pr: opts.pixelRatio ?? 1 };
    }
    this.renderer.setPixelRatio(this.fixedSize ? this.fixedSize.pr : Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(
      this.fixedSize ? this.fixedSize.w : (container.clientWidth || innerWidth),
      this.fixedSize ? this.fixedSize.h : (container.clientHeight || innerHeight),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'match-canvas';
    container.appendChild(this.canvas);
    this.scene.background = new THREE.Color('#7fb6e0');
    this.scene.fog = new THREE.Fog('#7fb6e0', 160, 260);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight('#e8f6ff', '#2f6b35', 2.35); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff1cb', 2.4); sun.position.set(-25, 42, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45; this.scene.add(sun);
    this.buildWorld();
    const sphere = new THREE.SphereGeometry(FIELD.ballRadius, 16, 12);
    this.ball = new THREE.Group();
    const leather = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: .55, flatShading: false }));
    leather.castShadow = true; this.ball.add(leather);
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.31, 16), new THREE.MeshBasicMaterial({ color: '#183d24', transparent: true, opacity: .34 }));
    this.ballShadow.rotation.x = -Math.PI / 2; this.ballShadow.position.y = .012; this.scene.add(this.ballShadow);
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
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 84), new THREE.MeshStandardMaterial({ color: '#2e7840', roughness: 1 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -.015; this.scene.add(apron);
    const grass = new THREE.MeshStandardMaterial({ color: '#35a047', roughness: 1 });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(94, 60), grass); pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; this.scene.add(pitch);
    const stripeMat = new THREE.MeshBasicMaterial({ color: '#2c8340', transparent: true, opacity: .5 });
    for (let x = -40; x <= 40; x += 16) { const stripe = new THREE.Mesh(new THREE.PlaneGeometry(8, 58), stripeMat); stripe.rotation.x = -Math.PI / 2; stripe.position.set(x, .006, 0); this.scene.add(stripe); }
    const line = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const addLine = (x: number, z: number, sx: number, sz: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, .025, sz), line); m.position.set(x, .026, z); this.scene.add(m); };
    addLine(0, -29, 92, .16); addLine(0, 29, 92, .16); addLine(-46, 0, .16, 58); addLine(46, 0, .16, 58); addLine(0, 0, .12, 58);
    const circle = new THREE.Mesh(new THREE.RingGeometry(5.7, 5.87, 48), line); circle.rotation.x = -Math.PI / 2; circle.position.y = .028; this.scene.add(circle);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(.18, 12), line); dot.rotation.x=-Math.PI/2; dot.position.y=.04; this.scene.add(dot);
    for (const x of [-46, 46]) {
      const dir = Math.sign(x);
      // Penalty: 14 metres deep and 30 wide.  Goal area: 5 deep and 14 wide.
      addLine(x - dir * 14, 0, .12, 30); addLine(x - dir * 7, -15, 14, .12); addLine(x - dir * 7, 15, 14, .12);
      addLine(x - dir * 5, 0, .12, 14); addLine(x - dir * 2.5, -7, 5, .12); addLine(x - dir * 2.5, 7, 5, .12);
      const spot = dot.clone(); spot.position.set(x-dir*11,.04,0); this.scene.add(spot);
      const points: THREE.Vector3[]=[]; const start=x>0?Math.PI/2:-Math.PI/2; const end=x>0?Math.PI*1.5:Math.PI/2;
      for(let i=0;i<=24;i++){const t=start+(end-start)*i/24;points.push(new THREE.Vector3(x-dir*11+Math.cos(t)*5.5,.045,Math.sin(t)*5.5));}
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color:'#ffffff'})); this.scene.add(arc);
    }
    const centreDot=dot.clone();centreDot.position.set(0,.04,0);this.scene.add(centreDot);
    // Corner arcs: quarter-circles tucked into each corner flag.
    for (const cx of [-46, 46]) for (const cz of [-29, 29]) {
      const pts: THREE.Vector3[] = [];
      const base = Math.atan2(-cz, -cx);
      for (let i = 0; i <= 10; i++) { const a = base - Math.PI / 4 + (i / 10) * Math.PI / 2; pts.push(new THREE.Vector3(cx + Math.cos(a), .045, cz + Math.sin(a))); }
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff' })));
    }
    this.buildGoals(); this.buildStands();
  }

  private buildGoals() {
    const postMat = new THREE.MeshStandardMaterial({ color: '#fffef4', roughness: .4 });
    const netMat = new THREE.LineBasicMaterial({ color: '#f2f7f2', transparent: true, opacity: .6 });
    for (const x of [-46, 46]) {
      const g = new THREE.Group(); const d = x < 0 ? -1 : 1;
      const post = new THREE.CylinderGeometry(.12, .12, 2.8, 10); for (const z of [-4.4, 4.4]) { const p = new THREE.Mesh(post, postMat); p.position.set(x, 1.4, z); p.castShadow = true; g.add(p); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 9.0, 10), postMat); bar.rotation.x = Math.PI / 2; bar.position.set(x, 2.8, 0); bar.castShadow = true; g.add(bar);
      // Back, roof and two sides only: the goal mouth remains physically and visually open.
      const lines: THREE.Vector3[]=[]; const back=x+d*2.2;
      for(let z=-4.4;z<=4.401;z+=.55){lines.push(new THREE.Vector3(back,0,z),new THREE.Vector3(back,2.8,z));}
      for(let y=0;y<=2.801;y+=.4){lines.push(new THREE.Vector3(back,y,-4.4),new THREE.Vector3(back,y,4.4)); for(const z of [-4.4,4.4]) lines.push(new THREE.Vector3(x,y,z),new THREE.Vector3(back,y,z));}
      for(let z=-4.4;z<=4.401;z+=.55) lines.push(new THREE.Vector3(x,2.8,z),new THREE.Vector3(back,2.8,z));
      const net = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), netMat); net.name='net'; g.add(net); g.userData.side=x; this.goalNets.push(g); this.scene.add(g);
    }
  }

  private buildStands() {
    const concrete = new THREE.MeshStandardMaterial({ color: '#2c4d63', roughness: 1, flatShading: true });
    const crowdCols = ['#f8cc54', '#ec5a61', '#5fcddd', '#f3ede0', '#514b91', '#ff9a3d', '#7ee08a']; const box = new THREE.BoxGeometry(1.05, .72, .55);
    // Seven instanced colour blocks give the crowd a lively, modern mosaic without hundreds of draw calls.
    const fanPositions: THREE.Vector3[][] = crowdCols.map(() => []);
    // Only the far stand is built: every camera preset sits on +z looking
    // toward -z, so a near-side stand would stand between the camera and
    // the near touchline and hide players in low angles (close-up).
    // The low ad boards stay on both sides; they never block play.
    for (const z of [-36]) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(104, 9, 11), concrete); stand.position.set(0, 4.2, z); this.scene.add(stand);
      // Roof lip shading the top rows.
      const roof = new THREE.Mesh(new THREE.BoxGeometry(106, .5, 13), new THREE.MeshStandardMaterial({ color: '#1d3346', roughness: 1, flatShading: true }));
      roof.position.set(0, 10.6, z + (z > 0 ? 1 : -1)); this.scene.add(roof);
      for (let x = -49; x <= 49; x += 1.25) for (let r = 0; r < 8; r++) {
        const color = Math.abs((x * 5 + r * 3) | 0) % crowdCols.length;
        fanPositions[color].push(new THREE.Vector3(x, 6.4 + r * .58, z + (z > 0 ? -4.2 + r * .5 : 4.2 - r * .5)));
      }
      // Giant team-colour banner across the stand front, recoloured per match.
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(46, 2.2),
        new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      banner.position.set(0, 2.6, z + (z > 0 ? -5.56 : 5.56));
      if (z < 0) banner.rotation.y = Math.PI;
      this.scene.add(banner);
      this.standBanners.push(banner);
    }
    const matrix = new THREE.Matrix4();
    fanPositions.forEach((positions, color) => {
      const crowd = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: crowdCols[color] }), positions.length);
      positions.forEach((pos, i) => { matrix.makeTranslation(pos.x, pos.y, pos.z); crowd.setMatrixAt(i, matrix); });
      crowd.instanceMatrix.needsUpdate = true; this.scene.add(crowd);
    });
    for (const x of [-55,55]) { const e = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 68), concrete); e.position.set(x, 3.2, 0); this.scene.add(e); }
    // Floodlight pylons in the four corners: emissive heads, no real lights.
    const poleMat = new THREE.MeshStandardMaterial({ color: '#3a4350', roughness: .8, flatShading: true });
    const headMat = new THREE.MeshBasicMaterial({ color: '#fffbe8' });
    for (const px of [-58, 58]) for (const pz of [-38, 38]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.35, .5, 20, 6), poleMat);
      pole.position.set(px, 10, pz); this.scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, .6), headMat);
      head.position.set(px, 20.4, pz); head.lookAt(0, 0, 0); this.scene.add(head);
    }
    // Pitch-side sponsor boards: procedural LinkedIn / GitHub creatives from
    // render/ads.ts (1024x128 canvas textures, alternating slots). Display
    // only — the sim never sees them.
    const makeAd = (slot: number) => {
      const ad = adForSlot(slot);
      const c = document.createElement('canvas'); c.width = AD_W; c.height = AD_H;
      paintAd(c.getContext('2d')!, ad, AD_W, AD_H);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return new THREE.MeshBasicMaterial({ map: tex });
    };
    const ads = [makeAd(0), makeAd(1)];
    for (const z of [-30.3, 30.3]) for (let x = -40, i = 0; x < 40; x += 10, i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.15, .18), ads[i % 2]); b.position.set(x, .6, z); if (z < 0) b.rotation.y = Math.PI; this.scene.add(b); }
  }

  private makeAvatar(p: Player, state: MatchState): Avatar {
    const root = new THREE.Group(); const kit = new THREE.Color(state.teams[p.team].color), trim = new THREE.Color(state.teams[p.team].secondary);
    const bodyMat = new THREE.MeshStandardMaterial({ color: p.keeper ? '#6b64d9' : kit, roughness: .85, flatShading: true }); const skin = new THREE.MeshStandardMaterial({ color: ['#f0b68c','#985c3c','#d78f65','#6d422f'][p.id % 4], roughness: 1, flatShading:true }); const dark = new THREE.MeshStandardMaterial({ color: '#28283b', flatShading: true });
    const bootMat = new THREE.MeshStandardMaterial({ color: '#14141c', roughness: .6, flatShading: true });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.52, 12), new THREE.MeshBasicMaterial({color:'#153a20',transparent:true,opacity:.28})); shadow.rotation.x=-Math.PI/2; shadow.position.y=.014; this.scene.add(shadow);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.38,.48,.85,6),bodyMat); body.position.y=1.02; root.add(body);
    // Chest stripe in trim colour: team identity readable from the side stands.
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(.425,.465,.2,6), new THREE.MeshStandardMaterial({ color: trim, roughness: .9, flatShading: true }));
    stripe.position.y = 1.28; root.add(stripe);
    // Shirt number on the back, facing away from the direction of play.
    const number = new THREE.Mesh(new THREE.PlaneGeometry(.52,.52),
      new THREE.MeshBasicMaterial({ map: numberTexture(p.number), transparent: true }));
    number.position.set(0, 1.04, -.44); number.rotation.y = Math.PI; root.add(number);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),skin); head.position.y=1.7; root.add(head); const hair=new THREE.Mesh(new THREE.SphereGeometry(.325,8,5,0,Math.PI*2,0,Math.PI*.42),dark); hair.position.y=1.81; root.add(hair);
    const eyeMat=new THREE.MeshBasicMaterial({color:'#182230'}); for(const ex of [-.11,.11]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,5,4),eyeMat);eye.position.set(ex,1.72,.3);root.add(eye);}
    const limb = (mat:THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(.115,.13,.67,5),mat);
    const boot = () => { const b = new THREE.Mesh(new THREE.BoxGeometry(.17,.12,.32), bootMat); b.position.set(0,-.33,.07); return b; };
    const trimMat=new THREE.MeshStandardMaterial({color:trim,roughness:.9,flatShading:true});
    const legL=limb(trimMat),legR=limb(trimMat),armL=limb(bodyMat),armR=limb(bodyMat); legL.position.set(-.2,.38,0);legR.position.set(.2,.38,0);armL.position.set(-.48,1.08,0);armR.position.set(.48,1.08,0);
    legL.add(boot()); legR.add(boot());
    root.add(legL,legR,armL,armR);
    const shorts=new THREE.Mesh(new THREE.CylinderGeometry(.47,.4,.27,6),trimMat);shorts.position.y=.68;root.add(shorts); root.castShadow=true; this.scene.add(root);
    return {root,body,head,legL,legR,armL,armR,shadow,kit,trim,keeper:p.keeper,kitParts:[body,armL,armR],trimParts:[legL,legR,shorts,stripe]};
  }

  private ensureAvatars(state: MatchState) {
    while (this.avatars.length < state.players.length) this.avatars.push(this.makeAvatar(state.players[this.avatars.length], state));
    state.players.forEach((p,i)=>{const a=this.avatars[i], kit=p.keeper?'#6b64d9':state.teams[p.team].color, trim=state.teams[p.team].secondary; a.kitParts.forEach(m=>(m.material as THREE.MeshStandardMaterial).color.set(kit));a.trimParts.forEach(m=>(m.material as THREE.MeshStandardMaterial).color.set(trim));});
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
   * camera easing. The live-game `render()` path above is untouched.
   */
  renderSocial(state: MatchState, cam: SocialCameraPose, clockFixed = 1.0): void {
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
      a.root.position.set(p.x, 0, p.z);
      a.root.rotation.set(0, Math.atan2(p.facingX, p.facingZ), 0);
      a.legL.rotation.x = 0; a.legR.rotation.x = 0;
      a.armL.rotation.x = 0; a.armR.rotation.x = 0;
      a.armL.rotation.z = 0; a.armR.rotation.z = 0;
      a.shadow.position.set(p.x, .015, p.z);
      a.shadow.scale.setScalar(1);
    });
    this.marker.visible = false; this.arrow.visible = false; this.target.visible = false;
    for (const m of this.trail) m.visible = false;
    this.camPos.set(cam.pos.x, cam.pos.y, cam.pos.z);
    this.camLook.set(cam.look.x, cam.look.y, cam.look.z);
    if (this.camera.fov !== cam.fov) { this.camera.fov = cam.fov; this.camera.updateProjectionMatrix(); }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    for (const g of this.goalNets) {
      const net = g.getObjectByName('net');
      if (net) net.position.x = 0;
    }
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
