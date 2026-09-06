import * as THREE from 'three';
import { FIELD, MatchState, Player } from './types';

type Avatar = { root: THREE.Group; body: THREE.Mesh; head: THREE.Mesh; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh; shadow: THREE.Mesh; kit: THREE.Color; trim: THREE.Color; keeper: boolean; kitParts: THREE.Mesh[]; trimParts: THREE.Mesh[] };

export type CameraMode = 'broadcast' | 'tactic' | 'close';
export const CAMERA_MODES: CameraMode[] = ['broadcast', 'tactic', 'close'];
export const CAMERA_LABELS: Record<CameraMode, string> = { broadcast: 'BROADCAST', tactic: 'TACTICAL', close: 'CLOSE-UP' };
interface CameraFrame { pos: THREE.Vector3; look: THREE.Vector3; fov: number }

/**
 * Pure framing math (unit-testable): where the lens should sit for a mode,
 * aspect ratio and pitch focus. The look target is biased a few metres toward
 * the camera side (+z) so play renders above the bottom HUD strip instead of
 * sliding underneath it on short or high-DPI windows.
 */
export function computeCamera(mode: CameraMode, aspect: number, focusX: number, focusZ: number): CameraFrame {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const preset = {
    broadcast: { dx: -6, dy: 30, dz: 36, fov: 40 },
    tactic: { dx: 0, dy: 56, dz: 34, fov: 46 },
    close: { dx: -4, dy: 19, dz: 23, fov: 42 },
  }[mode];
  // Portrait windows need the lens farther back to keep a useful horizontal
  // slice; very wide-but-short windows need a touch more height for the near
  // touchline to clear the bottom UI.
  let fit = Math.max(1, 1.32 / safeAspect);
  if (safeAspect > 2.2) fit *= 1 + (safeAspect - 2.2) * 0.3;
  return {
    pos: new THREE.Vector3(focusX + preset.dx * fit, preset.dy * fit, focusZ + preset.dz * fit),
    look: new THREE.Vector3(focusX, 0, focusZ + 2.5),
    fov: preset.fov,
  };
}

/** Smoothstep easing shared by all cinematics (0→0, 1→1, monotonic). */
export function easeInOut(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/** Follow focus from ball + controlled player, clamped so the lens never leaves the stadium. */
export function followFocus(ballX: number, ballZ: number, cpX: number, cpZ: number): { x: number; z: number } {
  return {
    x: THREE.MathUtils.clamp(ballX * .8 + cpX * .2, -36, 36),
    z: THREE.MathUtils.clamp(ballZ * .85 + cpZ * .15, -22, 22),
  };
}

/** Goal-cinematic end pose: low behind the scored goal, looking at the mouth. */
export function goalCineEnd(side: number, ballZ: number): { pos: THREE.Vector3; look: THREE.Vector3 } {
  const s = side >= 0 ? 1 : -1;
  const bz = THREE.MathUtils.clamp(ballZ * .4, -8, 8);
  return {
    pos: new THREE.Vector3(s * (FIELD.halfLength + 13), 6.5, bz + (ballZ >= 0 ? 9 : -9)),
    look: new THREE.Vector3(s * (FIELD.halfLength - 2), 1.2, 0),
  };
}

/** Menu showcase orbit position for an angle (constant radius/height). */
export function menuOrbitPos(angle: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(angle) * 58, 26, Math.cos(angle) * 58);
}

type Cine = { type: 'goal' | 'intro'; t: number; dur: number; side: number; fromPos: THREE.Vector3; fromLook: THREE.Vector3 } | null;

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
  private camLook = new THREE.Vector3();
  private camPos = new THREE.Vector3(0, 29, 38);
  private clock = 0;
  private lastFlight = 'roll';
  private shake = 0;
  private cameraMode: CameraMode = 'broadcast';
  private lastPhase = '';
  private cine: Cine = null;
  private menuAngle = 0;
  private endAngle = 0;

  cycleCamera(): CameraMode {
    this.cameraMode = CAMERA_MODES[(CAMERA_MODES.indexOf(this.cameraMode) + 1) % CAMERA_MODES.length];
    return this.cameraMode;
  }
  cameraLabel(): string { return CAMERA_LABELS[this.cameraMode]; }
  /** True while a letterboxed cinematic (goal replay sweep) owns the lens. */
  inCinematic(): boolean { return this.cine?.type === 'goal'; }

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth || innerWidth, container.clientHeight || innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'match-canvas';
    container.appendChild(this.canvas);
    this.scene.background = new THREE.Color('#91cce3');
    this.scene.fog = new THREE.Fog('#91cce3', 160, 260);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight('#e8f6ff', '#326a35', 2.15); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff1cb', 2.4); sun.position.set(-25, 42, 18); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45; this.scene.add(sun);
    this.buildWorld();
    const sphere = new THREE.SphereGeometry(FIELD.ballRadius, 12, 8);
    this.ball = new THREE.Group();
    const leather = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color: '#f7f3e9', roughness: .78, flatShading: true }));
    leather.castShadow = true; this.ball.add(leather);
    // Tiny dark poly patches stop the ball disappearing into white lines at a distance.
    const patchMaterial = new THREE.MeshStandardMaterial({ color: '#1f3040', roughness: .9, flatShading: true });
    const patchGeometry = new THREE.DodecahedronGeometry(.06, 0);
    [[0,.24,0],[.21,.08,.11],[-.19,.02,.15],[.04,-.12,-.21]].forEach(([x,y,z]) => { const patch = new THREE.Mesh(patchGeometry, patchMaterial); patch.position.set(x,y,z); this.ball.add(patch); });
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.31, 16), new THREE.MeshBasicMaterial({ color: '#183d24', transparent: true, opacity: .34 }));
    this.ballShadow.rotation.x = -Math.PI / 2; this.ballShadow.position.y = .012; this.scene.add(this.ballShadow);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(.72, .88, 24), new THREE.MeshBasicMaterial({ color: '#35f8f0', side: THREE.DoubleSide, transparent: true, opacity: .96 }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.position.y = .025; this.scene.add(this.marker);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(.28, .68, 4), new THREE.MeshBasicMaterial({ color: '#fff253' })); this.scene.add(this.arrow);
    this.target = new THREE.Mesh(new THREE.RingGeometry(.33, .40, 16), new THREE.MeshBasicMaterial({ color: '#fff253', transparent: true, opacity: .72, side: THREE.DoubleSide })); this.target.rotation.x = -Math.PI / 2; this.target.position.y = .03; this.scene.add(this.target);
    this.resize(); addEventListener('resize', () => this.resize());
  }

  private buildWorld() {
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 84), new THREE.MeshStandardMaterial({ color: '#2e7840', roughness: 1 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -.015; this.scene.add(apron);
    const grass = new THREE.MeshStandardMaterial({ color: '#3e9b48', roughness: 1 });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(94, 60), grass); pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; this.scene.add(pitch);
    const stripeMat = new THREE.MeshBasicMaterial({ color: '#358b42', transparent: true, opacity: .42 });
    for (let x = -40; x <= 40; x += 16) { const stripe = new THREE.Mesh(new THREE.PlaneGeometry(8, 58), stripeMat); stripe.rotation.x = -Math.PI / 2; stripe.position.set(x, .006, 0); this.scene.add(stripe); }
    const line = new THREE.MeshBasicMaterial({ color: '#f7ffe9' });
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
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color:'#f7ffe9'})); this.scene.add(arc);
    }
    const centreDot=dot.clone();centreDot.position.set(0,.04,0);this.scene.add(centreDot);
    this.buildGoals(); this.buildStands();
  }

  private buildGoals() {
    const postMat = new THREE.MeshStandardMaterial({ color: '#fff9df', roughness: .55 });
    const netMat = new THREE.LineBasicMaterial({ color: '#e9f7ed', transparent: true, opacity: .46 });
    for (const x of [-46, 46]) {
      const g = new THREE.Group(); const d = x < 0 ? -1 : 1;
      const post = new THREE.CylinderGeometry(.075, .075, 2.8, 8); for (const z of [-4.4, 4.4]) { const p = new THREE.Mesh(post, postMat); p.position.set(x, 1.4, z); g.add(p); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, 8.9, 8), postMat); bar.rotation.x = Math.PI / 2; bar.position.set(x, 2.8, 0); g.add(bar);
      // Back, roof and two sides only: the goal mouth remains physically and visually open.
      const lines: THREE.Vector3[]=[]; const back=x+d*2;
      for(let z=-4.4;z<=4.401;z+=.88){lines.push(new THREE.Vector3(back,0,z),new THREE.Vector3(back,2.8,z));}
      for(let y=0;y<=2.801;y+=.56){lines.push(new THREE.Vector3(back,y,-4.4),new THREE.Vector3(back,y,4.4)); for(const z of [-4.4,4.4]) lines.push(new THREE.Vector3(x,y,z),new THREE.Vector3(back,y,z));}
      for(let z=-4.4;z<=4.401;z+=.88) lines.push(new THREE.Vector3(x,2.8,z),new THREE.Vector3(back,2.8,z));
      const net = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), netMat); net.name='net'; g.add(net); g.userData.side=x; this.goalNets.push(g); this.scene.add(g);
    }
  }

  private buildStands() {
    const concrete = new THREE.MeshStandardMaterial({ color: '#31556b', roughness: 1, flatShading: true });
    const crowdCols = ['#f8cc54', '#ec5a61', '#5fcddd', '#f3ede0', '#514b91']; const box = new THREE.BoxGeometry(1.05, .72, .55);
    // Five instanced colour blocks give the crowd a lively, pixel-era mosaic without hundreds of draw calls.
    const fanPositions: THREE.Vector3[][] = crowdCols.map(() => []);
    for (const z of [-36, 36]) {
      const stand = new THREE.Mesh(new THREE.BoxGeometry(104, 7, 10), concrete); stand.position.set(0, 3.3, z); this.scene.add(stand);
      for (let x = -49; x <= 49; x += 1.25) for (let r = 0; r < 5; r++) {
        const color = Math.abs((x * 5 + r * 3) | 0) % crowdCols.length;
        fanPositions[color].push(new THREE.Vector3(x, 7.1 + r * .6, z + (z > 0 ? -3.8 + r * .5 : 3.8 - r * .5)));
      }
    }
    const matrix = new THREE.Matrix4();
    fanPositions.forEach((positions, color) => {
      const crowd = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: crowdCols[color] }), positions.length);
      positions.forEach((pos, i) => { matrix.makeTranslation(pos.x, pos.y, pos.z); crowd.setMatrixAt(i, matrix); });
      crowd.instanceMatrix.needsUpdate = true; this.scene.add(crowd);
    });
    for (const x of [-55,55]) { const e = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 68), concrete); e.position.set(x, 2.5, 0); this.scene.add(e); }
    const makeAd = (text:string, base:string, ink:string) => { const c=document.createElement('canvas');c.width=512;c.height=64;const ctx=c.getContext('2d')!;ctx.fillStyle=base;ctx.fillRect(0,0,512,64);ctx.fillStyle=ink;ctx.font='bold 31px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,34);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:tex}); };
    const ads=[makeAd('SATURDAY CUP','#173667','#ffe76a'),makeAd('PLAY BEAUTIFUL','#ef713d','#fff4d4')];
    for (const z of [-30.3,30.3]) for(let x=-40, i=0;x<40;x+=10,i++){ const b=new THREE.Mesh(new THREE.BoxGeometry(9.6,1.15,.18),ads[i%2]); b.position.set(x,.6,z); if(z<0)b.rotation.y=Math.PI; this.scene.add(b); }
  }

  private makeAvatar(p: Player, state: MatchState): Avatar {
    const root = new THREE.Group(); const kit = new THREE.Color(state.teams[p.team].color), trim = new THREE.Color(state.teams[p.team].secondary);
    const bodyMat = new THREE.MeshStandardMaterial({ color: p.keeper ? '#6b64d9' : kit, roughness: .9, flatShading: true }); const skin = new THREE.MeshStandardMaterial({ color: ['#f0b68c','#985c3c','#d78f65','#6d422f'][p.id % 4], roughness: 1, flatShading:true }); const dark = new THREE.MeshStandardMaterial({ color: '#28283b', flatShading: true });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.52, 12), new THREE.MeshBasicMaterial({color:'#153a20',transparent:true,opacity:.28})); shadow.rotation.x=-Math.PI/2; shadow.position.y=.014; this.scene.add(shadow);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.38,.48,.85,6),bodyMat); body.position.y=1.02; root.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),skin); head.position.y=1.7; root.add(head); const hair=new THREE.Mesh(new THREE.SphereGeometry(.325,8,5,0,Math.PI*2,0,Math.PI*.42),dark); hair.position.y=1.81; root.add(hair);
    const eyeMat=new THREE.MeshBasicMaterial({color:'#182230'}); for(const ex of [-.11,.11]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,5,4),eyeMat);eye.position.set(ex,1.72,.3);root.add(eye);}
    const limb = (mat:THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(.115,.13,.67,5),mat);
    const trimMat=new THREE.MeshStandardMaterial({color:trim,roughness:.9,flatShading:true});
    const legL=limb(trimMat),legR=limb(trimMat),armL=limb(bodyMat),armR=limb(bodyMat); legL.position.set(-.2,.38,0);legR.position.set(.2,.38,0);armL.position.set(-.48,1.08,0);armR.position.set(.48,1.08,0);root.add(legL,legR,armL,armR);
    const shorts=new THREE.Mesh(new THREE.CylinderGeometry(.47,.4,.27,6),trimMat);shorts.position.y=.68;root.add(shorts); root.castShadow=true; this.scene.add(root);
    return {root,body,head,legL,legR,armL,armR,shadow,kit,trim,keeper:p.keeper,kitParts:[body,armL,armR],trimParts:[legL,legR,shorts]};
  }

  private ensureAvatars(state: MatchState) {
    while (this.avatars.length < state.players.length) this.avatars.push(this.makeAvatar(state.players[this.avatars.length], state));
    state.players.forEach((p,i)=>{const a=this.avatars[i], kit=p.keeper?'#6b64d9':state.teams[p.team].color, trim=state.teams[p.team].secondary; a.kitParts.forEach(m=>(m.material as THREE.MeshStandardMaterial).color.set(kit));a.trimParts.forEach(m=>(m.material as THREE.MeshStandardMaterial).color.set(trim));});
  }

  /** Follow target: tracks the ball tightly so sidelines stay near frame centre. */
  private followFrame(state: MatchState): CameraFrame {
    const ball = state.ball, cp = state.players[state.controlled];
    const f = followFocus(ball.x, ball.z, cp?.x || 0, cp?.z || 0);
    return computeCamera(this.cameraMode, this.camera.aspect, f.x, f.z);
  }

  private applyFrame(frame: CameraFrame, dt: number, stiff = false) {
    if (this.camera.fov !== frame.fov) { this.camera.fov = frame.fov; this.camera.updateProjectionMatrix(); }
    const kp = 1 - Math.exp(-dt * (stiff ? 8 : 3)), kl = 1 - Math.exp(-dt * (stiff ? 8 : 4));
    this.camPos.lerp(frame.pos, kp); this.camLook.lerp(frame.look, kl);
  }

  private startCine(state: MatchState, type: 'goal' | 'intro', dur: number) {
    this.cine = { type, t: 0, dur, side: Math.sign(state.ball.x) || 1, fromPos: this.camPos.clone(), fromLook: this.camLook.clone() };
  }

  private updateGoalCine(state: MatchState, dt: number) {
    const c = this.cine; if (!c) return;
    c.t += dt;
    const ease = easeInOut(c.t / c.dur);
    const end = goalCineEnd(c.side, state.ball.z);
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
    const end = this.followFrame(state);
    const high = new THREE.Vector3(0, 58, -6);
    const pos = high.lerp(end.pos, ease);
    if (this.camera.fov !== end.fov) { this.camera.fov = end.fov; this.camera.updateProjectionMatrix(); }
    this.camPos.lerp(pos, 1 - Math.exp(-dt * 6)); this.camLook.lerp(end.look, 1 - Math.exp(-dt * 6));
    if (c.t >= c.dur) this.cine = null;
  }

  render(state: MatchState, dt: number, menu = false) {
    this.clock += Math.min(dt,.05); this.ensureAvatars(state);
    const ball = state.ball; if(ball.flight==='shot'&&this.lastFlight!=='shot')this.shake=.22;this.lastFlight=ball.flight;this.shake=Math.max(0,this.shake-dt*.9);
    this.ball.position.set(ball.x, Math.max(.25,ball.y), ball.z); this.ball.rotation.x += ball.vz * dt * 2; this.ball.rotation.z -= ball.vx * dt * 2; this.ballShadow.position.set(ball.x,.015,ball.z); this.ballShadow.scale.setScalar(1 + Math.min(1,ball.y)*.45);
    state.players.forEach((p,i) => { const a=this.avatars[i], speed=Math.hypot(p.vx,p.vz); a.root.position.set(p.x,0,p.z); a.root.rotation.set(0,Math.atan2(p.facingX,p.facingZ),0); const run=p.action==='run'||speed>1; const swing=run?Math.sin(this.clock*(8+speed*1.5)+i)*Math.min(.85,.22+speed*.12):0; a.legL.rotation.x=swing;a.legR.rotation.x=-swing;a.armL.rotation.x=-swing*.72;a.armR.rotation.x=swing*.72; if(p.action==='kick'){a.legR.rotation.x=-1.35*Math.min(1,p.actionTime*9)} if(p.action==='tackle'){a.root.rotation.z=.32*Math.sin(Math.min(1,p.actionTime*5))} if(p.action==='dive'){a.root.rotation.z=p.facingZ*.95;a.root.rotation.x=-p.facingX*.55;a.root.position.y=.26} else a.root.position.y=0; a.shadow.position.set(p.x,.015,p.z); a.shadow.scale.setScalar(p.action==='dive'?1.45:1); });
    const cp=state.players[state.controlled]; if(cp){this.marker.visible=!menu;this.arrow.visible=!menu;this.marker.position.set(cp.x,.03,cp.z);this.arrow.position.set(cp.x,2.65+Math.sin(this.clock*5)*.08,cp.z);this.arrow.rotation.x=Math.PI;}
    const tp=state.targetPlayer===null?null:state.players[state.targetPlayer];this.target.visible=!!tp&&!menu;if(tp)this.target.position.set(tp.x,.04,tp.z);
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
    } else this.applyFrame(this.followFrame(state), dt);
    this.camera.position.copy(this.camPos);
    if(this.shake>0)this.camera.position.add(new THREE.Vector3(Math.sin(this.clock*55)*this.shake,Math.cos(this.clock*71)*this.shake*.45,0));this.camera.lookAt(this.camLook);
    for (const g of this.goalNets) {
      const side=g.userData.side as number; const scored=state.phase==='goal'&&Math.sign(ball.x)===Math.sign(side); const net=g.getObjectByName('net');
      if(net){const pulse=scored?Math.sin(Math.min(1,state.phaseTime)*Math.PI)*.22:0;net.position.x=Math.sign(side)*pulse;}
    }
    this.renderer.render(this.scene,this.camera);
  }
  resize(){
    // NOTE: updateStyle must stay enabled. With `false`, high-DPI screens keep
    // a canvas buffer larger than its CSS box, so the frame overflows and the
    // near touchline slides out of view as resolution scales up.
    const parent=this.canvas.parentElement;const w=parent?.clientWidth||innerWidth,h=parent?.clientHeight||innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);
  }
  dispose(){this.renderer.dispose();this.canvas.remove();}
}
