import { EMPTY_ACTION, EMPTY_INPUT, FIELD, TEAMS, type ActionKind, type Ball, type ControllerActionState, type GameEvent, type InputFrame, type MatchState, type Player, type Restart, type RestartBuf, type TeamId, type Vec } from './types';
import { clamp, distance, direction, length, other, segDist } from './game/math';
import { TUNING } from './game/tuning';

/** Ticks of PASS hold that turn a feet pass into a lead pass (~183ms). */
const PASS_LEAD_TICKS = 11;
/** Aim-cone half angle for pass target selection (~±42°). */
const PASS_CONE = 0.74;
/** Action kinds as small ints for the canonical hash (stable ordering). */
const ACTION_IDS: Record<string, number> = { pass: 1, leadpass: 2, shot: 3, challenge: 4, slide: 5, 'outlet-short': 6, 'outlet-long': 7 };

export { TUNING } from './game/tuning';

const L = FIELD.halfLength, W = FIELD.halfWidth, R = FIELD.ballRadius;

/** A strike waiting for imminent foot contact (first-time finishes). */
type ShotBuf = { actor: number; until: number; u: number; v: number; pow: number } | null;
/** A committed keeper dive: locked direction, expiry, and start point for the
 *  swept hand capsule. Never redirected once committed. */
export interface KeeperDive { until: number; dx: number; dz: number; sx: number; sz: number }
/** Persistent per-team responsibilities (P0.6 shape model). */
export interface TeamRoles {
  presser: number | null; cover: number | null; runner: number | null; runnerUntil: number;
}
const FRESH_ROLES = (): TeamRoles => ({ presser: null, cover: null, runner: null, runnerUntil: 0 });

/** Full deterministic snapshot: state plus every RNG/private field the sim reads. */
export interface EngineSnapshot {
  state: MatchState; seed: number; tick: number;
  actions: [ControllerActionState, ControllerActionState];
  passNominee: [number | null, number | null]; passAim: [Vec, Vec];
  switchIdx: [number, number]; shotBuf: [ShotBuf, ShotBuf];
  charge: number; chargingPlayer: number | null;
  receiver: number | null; receivePoint: Vec; receiveUntil: number;
  keeperHold: [number, number]; keeperReact: [number, number]; keeperCmd: [number, number];
  keeperDive: [KeeperDive | null, KeeperDive | null];
  slideSrc: (Vec | null)[];
  roles: [TeamRoles, TeamRoles]; buildupUntil: number; buildupTeam: TeamId;
  restartBuf: RestartBuf | null;
  previousBall: { x: number; y: number; z: number }; scorer: TeamId; idleTime: number;
  peerReceiver: number | null; peerReceivePoint: Vec; peerReceiveUntil: number;
  peerCharge: number; peerChargingPlayer: number | null;
}

/** Fixed-step arcade simulation. Coordinates are metres; x runs along the pitch. */
export class MatchEngine {
  state: MatchState;
  events: GameEvent[] = [];
  private seed: number;
  /** Simulation tick index: increments once per update() step, drives action identity. */
  tick = 0;
  /** Passive per-side gesture state — the action contract (see types.ts). */
  private actions: [ControllerActionState, ControllerActionState] = [
    { ...EMPTY_ACTION }, { ...EMPTY_ACTION },
  ];
  /** A strike waiting for imminent foot contact (first-time finishes). */
  private shotBuf: [ShotBuf, ShotBuf] = [null, null];
  private passNominee: [number | null, number | null] = [null, null];
  private passAim: [Vec, Vec] = [{ x: 1, z: 0 }, { x: -1, z: 0 }];
  /** Manual-switch cycle position per side: repeated SWITCH presses walk the
   *  cost-ordered candidate list predictably instead of re-picking nearest. */
  private switchIdx: [number, number] = [0, 0];
  private charge = 0;
  private chargingPlayer: number | null = null;
  private receiver: number | null = null;
  private receivePoint: Vec = { x: 0, z: 0 };
  private receiveUntil = 0;
  private keeperHold = [0, 0];
  private keeperReact = [0, 0];
  /** Slide origin per player id (swept capsule); null when no live slide. */
  private slideSrc: (Vec | null)[] = Array.from({ length: 22 }, () => null);
  /** Team shape roles + keeper-distribution transition window. */
  private roles: [TeamRoles, TeamRoles] = [FRESH_ROLES(), FRESH_ROLES()];
  private buildupUntil = 0;
  private buildupTeam: TeamId = 0;
  /** Buffered restart edge pressed during the setup window. */
  private restartBuf: RestartBuf | null = null;
  /** Committed dive per side (null when standing). Part of snapshots + hash. */
  private keeperDive: [KeeperDive | null, KeeperDive | null] = [null, null];
  /** Last hold-time at which the human issued a distribution command (aim or
   *  button). Zero = no command yet: the idle keeper falls back to the same
   *  safe decision the AI uses instead of forcing a covered short ball. */
  private keeperCmd = [0, 0];
  private previousBall = { x: 0, z: 0, y: R };
  private scorer: TeamId = 0;
  private idleTime = 0;
  // Peer's (second human) in-flight state. Mirrors receiver/receivePoint/
  // receiveUntil/charge above; included in snapshots and hashes.
  private peerReceiver: number | null = null;
  private peerReceivePoint: Vec = { x: 0, z: 0 };
  private peerReceiveUntil = 0;
  private peerCharge = 0;
  private peerChargingPlayer: number | null = null;

  constructor(teamIndex = 0, halfDuration = 180, seed = 1) {
    this.seed = seed >>> 0 || 1;
    const names = ['Hale', 'Costa', 'Miro', 'Benn', 'Rossi', 'Khan', 'Silva', 'Nolan', 'Vega', 'Dane', 'Ortega'];
    const homes = [[-43, 0], [-29, -21], [-30, -7], [-30, 7], [-29, 21], [-9, -20], [-11, -7], [-11, 7], [-9, 20], [13, -7], [13, 7]];
    const players: Player[] = [];
    for (let t = 0; t < 2; t++) for (let i = 0; i < 11; i++) {
      const a = t === 0 ? 1 : -1;
      players.push({ id: t * 11 + i, team: t as TeamId, number: i + 1, name: names[(i + t * 3) % 11], keeper: i === 0,
        x: homes[i][0] * a, z: homes[i][1], homeX: homes[i][0] * a, homeZ: homes[i][1], vx: 0, vz: 0,
        facingX: a, facingZ: 0, stamina: 1, cooldown: 0, action: 'idle', actionTime: 0, think: .5 + this.random(), aiState: 'RETURN_TO_POSITION', touchIn: 0 });
    }
    this.state = { players, ball: { x: 0, z: 0, y: R, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll' },
      teams: [TEAMS[teamIndex % 4], TEAMS[(teamIndex + 1) % 4]], humanTeam: 0, controlled: 10,
      remoteTeam: null, peerControlled: -1, peerTarget: null,
      phase: 'kickoff', phaseTime: 0, half: 1, elapsed: 0, halfDuration, score: [0, 0], attack: [1, -1],
      restart: null, paused: false, message: 'KICK OFF', messageTime: 2, charge: 0, targetPlayer: null, time: 0,
      stats: { shots: [0, 0], saves: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [0, 0] } };
    this.kickoff(0);
  }
  /** Attach a second human to a team (online peer). That team stops being AI-driven. */
  setRemoteTeam(t: TeamId) {
    if (t === this.state.humanTeam) throw new Error('remote team must differ from human team');
    this.state.remoteTeam = t;
    this.state.peerControlled = t * 11 + 10;
    this.state.peerTarget = null;
  }
  /** Peer left / link dead: their team falls back to AI. Control slots reset. */
  dropPeer() {
    this.state.remoteTeam = null;
    this.state.peerControlled = -1;
    this.state.peerTarget = null;
    this.peerReceiver = null;
    this.peerCharge = 0;
    this.peerChargingPlayer = null;
  }
  /** Controlled player id for a team (human side, peer side, or -1 for AI). */
  controlOf(t: TeamId): number {
    return t === this.state.humanTeam ? this.state.controlled
      : t === this.state.remoteTeam ? this.state.peerControlled : -1;
  }
  /** Target marker for a team, if any. */
  targetOf(t: TeamId): number | null {
    return t === this.state.humanTeam ? this.state.targetPlayer
      : t === this.state.remoteTeam ? this.state.peerTarget : null;
  }
  /** Per-side control slots: local human uses state fields, peer uses peer fields. */
  private getControlled(t: TeamId) { return t === this.state.humanTeam ? this.state.controlled : this.state.peerControlled; }
  private setControlled(t: TeamId, id: number) {
    if (t === this.state.humanTeam) this.state.controlled = id;
    else if (t === this.state.remoteTeam) this.state.peerControlled = id;
  }
  private setTarget(t: TeamId, id: number | null) {
    if (t === this.state.humanTeam) this.state.targetPlayer = id;
    else if (t === this.state.remoteTeam) this.state.peerTarget = id;
  }
  private setReceiver(t: TeamId, id: number | null, point?: Vec, until?: number) {
    // Side UI/target slots. The shared in-flight triple (receiver/receivePoint/
    // receiveUntil, used by AI chase + ball magnet) is maintained separately.
    if (t === this.state.humanTeam) {
      this.state.targetPlayer = id;
    } else if (t === this.state.remoteTeam) {
      this.peerReceiver = id; this.state.peerTarget = id;
      if (id !== null && point && until !== undefined) { this.peerReceivePoint = point; this.peerReceiveUntil = until; }
    }
  }
  private clearReceiver(t: TeamId) { this.setReceiver(t, null); }
  private liveReceiver(id: number | null, until: number) { return id !== null && until > this.state.time; }
  private isLiveReceiver(id: number) {
    return (this.liveReceiver(this.receiver, this.receiveUntil) && id === this.receiver) ||
      (this.liveReceiver(this.peerReceiver, this.peerReceiveUntil) && id === this.peerReceiver);
  }
  private isHumanControlled(id: number) { return id === this.state.controlled || id === this.state.peerControlled; }

  /** Deep, allocation-safe snapshot for rollback netcode and replays. */
  snapshot(): EngineSnapshot {
    return {
      state: structuredClone(this.state), seed: this.seed, tick: this.tick,
      actions: [structuredClone(this.actions[0]), structuredClone(this.actions[1])],
      passNominee: [...this.passNominee] as [number | null, number | null],
      passAim: [{ ...this.passAim[0] }, { ...this.passAim[1] }] as [Vec, Vec],
      switchIdx: [...this.switchIdx] as [number, number],
      shotBuf: [this.shotBuf[0] ? { ...this.shotBuf[0] } : null, this.shotBuf[1] ? { ...this.shotBuf[1] } : null] as [ShotBuf, ShotBuf],
      charge: this.charge, chargingPlayer: this.chargingPlayer,
      receiver: this.receiver, receivePoint: { ...this.receivePoint }, receiveUntil: this.receiveUntil,
      keeperHold: [...this.keeperHold] as [number, number],
      keeperCmd: [...this.keeperCmd] as [number, number],
      keeperDive: [this.keeperDive[0] ? { ...this.keeperDive[0] } : null, this.keeperDive[1] ? { ...this.keeperDive[1] } : null] as [KeeperDive | null, KeeperDive | null],
      slideSrc: this.slideSrc.map((v) => (v ? { ...v } : null)),
      roles: [{ ...this.roles[0] }, { ...this.roles[1] }],
      buildupUntil: this.buildupUntil, buildupTeam: this.buildupTeam,
      restartBuf: this.restartBuf ? { ...this.restartBuf } : null,
      keeperReact: [...this.keeperReact] as [number, number], previousBall: { ...this.previousBall },
      scorer: this.scorer, idleTime: this.idleTime,
      peerReceiver: this.peerReceiver, peerReceivePoint: { ...this.peerReceivePoint },
      peerReceiveUntil: this.peerReceiveUntil, peerCharge: this.peerCharge,
      peerChargingPlayer: this.peerChargingPlayer,
    };
  }
  restore(snap: EngineSnapshot) {
    this.state = structuredClone(snap.state); this.seed = snap.seed; this.tick = snap.tick;
    this.actions = [structuredClone(snap.actions[0]), structuredClone(snap.actions[1])];
    this.passNominee = [...(snap.passNominee ?? [null, null])] as [number | null, number | null];
    this.passAim = [{ ...(snap.passAim?.[0] ?? { x: 1, z: 0 }) }, { ...(snap.passAim?.[1] ?? { x: -1, z: 0 }) }] as [Vec, Vec];
    this.switchIdx = [...(snap.switchIdx ?? [0, 0])] as [number, number];
    const sb = snap.shotBuf ?? [null, null];
    this.shotBuf = [sb[0] ? { ...sb[0] } : null, sb[1] ? { ...sb[1] } : null];
    this.charge = snap.charge; this.chargingPlayer = snap.chargingPlayer;
    this.receiver = snap.receiver; this.receivePoint = { ...snap.receivePoint }; this.receiveUntil = snap.receiveUntil;
    this.keeperHold = [...snap.keeperHold]; this.keeperReact = [...snap.keeperReact]; this.keeperCmd = [...(snap.keeperCmd ?? [0, 0])];
    const kd = snap.keeperDive ?? [null, null];
    this.keeperDive = [kd[0] ? { ...kd[0] } : null, kd[1] ? { ...kd[1] } : null];
    const ss = snap.slideSrc ?? [];
    this.slideSrc = Array.from({ length: 22 }, (_, i) => (ss[i] ? { ...ss[i] } : null));
    const rr = snap.roles ?? [FRESH_ROLES(), FRESH_ROLES()];
    this.roles = [{ ...rr[0] }, { ...rr[1] }];
    this.buildupUntil = snap.buildupUntil ?? 0;
    this.buildupTeam = snap.buildupTeam ?? 0;
    this.restartBuf = snap.restartBuf ? { ...snap.restartBuf } : null;
    this.previousBall = { ...snap.previousBall }; this.scorer = snap.scorer; this.idleTime = snap.idleTime;
    this.peerReceiver = snap.peerReceiver; this.peerReceivePoint = { ...snap.peerReceivePoint };
    this.peerReceiveUntil = snap.peerReceiveUntil; this.peerCharge = snap.peerCharge;
    this.peerChargingPlayer = snap.peerChargingPlayer; this.events = [];
  }
  /** FNV-1a over quantized sim fields. Same inputs + seed must hash equal on any peer.
   *  Canonical: every future-affecting field is mixed in (gameplay only — no
   *  camera, audio, cosmetic or UI state lives in the engine). */
  hash(): number {
    let h = 0x811c9dc5;
    const mix = (n: number) => { h ^= (n | 0); h = Math.imul(h, 0x01000193); };
    const mixStr = (str: string) => { for (let i = 0; i < str.length; i++) mix(str.charCodeAt(i)); };
    const q = (v: number) => Math.round(v * 1000);
    const acts = { idle: 0, run: 1, kick: 2, tackle: 3, dive: 4, slide: 5, fallen: 6 };
    for (const p of this.state.players) {
      mix(p.id); mix(q(p.x)); mix(q(p.z)); mix(q(p.vx)); mix(q(p.vz));
      mix(q(p.facingX)); mix(q(p.facingZ)); mix(q(p.stamina)); mix(q(p.cooldown));
      mix(q(p.actionTime)); mix(q(p.think)); mix(acts[p.action]); mixStr(p.aiState); mix(q(p.touchIn));
    }
    const b = this.state.ball;
    mix(q(b.x)); mix(q(b.y)); mix(q(b.z)); mix(q(b.vx)); mix(q(b.vy)); mix(q(b.vz));
    mix(q(b.spin)); mix(b.owner ?? -1); mix(b.lastTouch); mix(q(b.lock)); mix(b.lastKicker ?? -1);
    mix({ roll: 0, pass: 1, through: 2, cross: 3, shot: 4 }[b.flight]);
    const s = this.state;
    mix(s.score[0]); mix(s.score[1]); mix(s.half); mix(q(s.elapsed)); mix(q(s.time));
    mix(s.phase.length + s.phase.charCodeAt(0)); mix(s.attack[0]); mix(s.controlled); mix(s.peerControlled);
    mix(s.targetPlayer ?? -1); mix(s.peerTarget ?? -1); mix(q(s.charge));
    if (s.restart) { mix(s.restart.team); mix(s.restart.taker); mix(q(s.restart.x)); mix(q(s.restart.z)); mix(q(s.restart.wait)); }
    else mix(7919);
    mix(s.stats.shots[0]); mix(s.stats.shots[1]); mix(s.stats.saves[0]); mix(s.stats.saves[1]);
    mix(s.stats.passes[0]); mix(s.stats.passes[1]); mix(s.stats.tackles[0]); mix(s.stats.tackles[1]);
    mix(this.seed); mix(this.tick);
    mix(this.receiver ?? -1); mix(q(this.receiveUntil));
    mix(q(this.receivePoint.x)); mix(q(this.receivePoint.z));
    mix(this.peerReceiver ?? -1); mix(q(this.peerReceiveUntil));
    mix(q(this.peerReceivePoint.x)); mix(q(this.peerReceivePoint.z));
    mix(q(this.charge)); mix(this.chargingPlayer ?? -1);
    mix(q(this.peerCharge)); mix(this.peerChargingPlayer ?? -1);
    mix(q(this.keeperHold[0])); mix(q(this.keeperHold[1])); mix(q(this.keeperCmd[0])); mix(q(this.keeperCmd[1]));
    mix(q(this.keeperReact[0])); mix(q(this.keeperReact[1]));
    for (const kdive of this.keeperDive) {
      if (kdive) { mix(q(kdive.until)); mix(q(kdive.dx)); mix(q(kdive.dz)); mix(q(kdive.sx)); mix(q(kdive.sz)); }
      else mix(0);
    }
    for (const ssrc of this.slideSrc) {
      if (ssrc) { mix(q(ssrc.x)); mix(q(ssrc.z)); }
      else mix(0);
    }
    for (const role of this.roles) {
      mix(role.presser ?? -1); mix(role.cover ?? -1); mix(role.runner ?? -1); mix(q(role.runnerUntil));
    }
    mix(q(this.buildupUntil)); mix(this.buildupTeam);
    if (this.restartBuf) { mix(this.restartBuf.pass ? 1 : 0); mix(this.restartBuf.shoot ? 1 : 0); mix(q(this.restartBuf.x)); mix(q(this.restartBuf.z)); }
    else mix(0);
    mix(q(this.previousBall.x)); mix(q(this.previousBall.z)); mix(q(this.previousBall.y));
    mix(this.scorer); mix(q(this.idleTime));
    for (const a of this.actions) {
      mix(a.actorId ?? -1); mix(a.action ? ACTION_IDS[a.action] ?? 0 : 0); mix(a.startedTick);
      mix(q(a.capturedMoveX)); mix(q(a.capturedMoveZ)); mix(q(a.shotAimU)); mix(q(a.shotAimV));
    }
    mix(this.passNominee[0] ?? -1); mix(this.passNominee[1] ?? -1);
    mix(this.switchIdx[0]); mix(this.switchIdx[1]);
    for (const sbScore of this.shotBuf) {
      if (sbScore) { mix(sbScore.actor); mix(sbScore.until); mix(q(sbScore.u)); mix(q(sbScore.v)); mix(q(sbScore.pow)); }
      else mix(0);
    }
    mix(q(this.passAim[0].x)); mix(q(this.passAim[0].z)); mix(q(this.passAim[1].x)); mix(q(this.passAim[1].z));
    return h >>> 0;
  }
  private random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  private team(t: TeamId) { return this.state.players.slice(t * 11, t * 11 + 11); }
  private owner() { const b = this.state.ball; return b.owner === null ? null : this.state.players[b.owner]; }
  private nearest(t: TeamId, at: Vec, exclude = -1) {
    let best = this.state.players[t * 11 + 1], score = Infinity;
    for (const p of this.team(t)) if (!p.keeper && p.id !== exclude) { const d = distance(p, at); if (d < score) { best = p; score = d; } }
    return best;
  }

  /** Current gesture for a side (action contract; read-only for UI/tests). */
  actionOf(t: TeamId): ControllerActionState { return this.actions[t]; }
  /** Intended pass destination while a ball is in flight to a nominee (UI/tests). */
  receiveDest(): Vec | null {
    if (this.liveReceiver(this.receiver, this.receiveUntil)) return { ...this.receivePoint };
    if (this.liveReceiver(this.peerReceiver, this.peerReceiveUntil)) return { ...this.peerReceivePoint };
    return null;
  }
  /** Capture a fresh gesture on button-down: identity, movement and aim frozen now. */
  private beginAction(t: TeamId, actorId: number, action: ActionKind, i: InputFrame) {
    this.actions[t] = {
      actorId, action, startedTick: this.tick,
      capturedMoveX: i.x, capturedMoveZ: i.z, shotAimU: i.aimU, shotAimV: i.aimV,
    };
  }
  private cancelAction(t: TeamId) {
    this.actions[t] = { ...EMPTY_ACTION };
  }

  update(dt: number, input: InputFrame = EMPTY_INPUT, peerInput: InputFrame = EMPTY_INPUT) {
    this.events = [];
    const s = this.state;
    if (s.paused || s.phase === 'halftime' || s.phase === 'fulltime') return;
    dt = clamp(dt, 0, .05); s.time += dt; this.tick++;
    s.messageTime = Math.max(0, s.messageTime - dt);
    for (const p of s.players) {
      p.cooldown = Math.max(0, p.cooldown - dt); p.actionTime = Math.max(0, p.actionTime - dt); p.think -= dt;
      if (p.actionTime <= 0) p.action = length(p.vx, p.vz) > .5 ? 'run' : 'idle';
    }
    if (s.phase === 'goal') { s.phaseTime += dt; if (s.phaseTime > 1.8) this.kickoff(other(this.scorer)); return; }
    if (s.phase !== 'playing') { this.takeRestart(dt, input, peerInput); return; }
    s.elapsed = Math.min(s.halfDuration, s.elapsed + dt);
    if (s.elapsed >= s.halfDuration) { this.endHalf(); return; }
    const oldOwner = this.owner(); if (oldOwner) s.stats.possession[oldOwner.team] += dt;
    this.selectControlSide(input, s.humanTeam);
    if (s.remoteTeam !== null) this.selectControlSide(peerInput, s.remoteTeam);
    this.moveHumanSide(dt, input, s.humanTeam);
    if (s.remoteTeam !== null) this.moveHumanSide(dt, peerInput, s.remoteTeam);
    this.updateAI(dt, input, peerInput);
    this.humanActionsSide(dt, input, s.humanTeam);
    if (s.remoteTeam !== null) this.humanActionsSide(dt, peerInput, s.remoteTeam);
    this.separatePlayers();
    this.integrateBall(dt);
    if (this.checkLines()) return;
    this.resolveChallenges();
    this.collectBall(dt);
    this.recover(dt);
  }

  private selectControlSide(input: InputFrame, team: TeamId) {
    const s = this.state, owner = this.owner();
    if (owner?.team === team && !owner.keeper) { this.setControlled(team, owner.id); return; }
    if (s.players[this.getControlled(team)].keeper) this.setControlled(team, this.nearest(team, s.ball).id);
    const cur = s.players[this.getControlled(team)];
    // A knocked-down selection is incapable: hand control to the best
    // candidate automatically (the only automatic defensive switch).
    if ((cur.action === 'fallen') && owner?.team !== team) {
      const auto = this.switchCandidates(team)[0];
      if (auto !== undefined && auto !== cur.id) this.setControlled(team, auto);
    }
    if (input.switchPlayer && owner?.team !== team) {
      // Stable cost-ordered cycle: repeated presses walk the candidate list
      // (interception time, danger side, recovery, cover). The current
      // selection is skipped so every press visibly changes players.
      const cands = this.switchCandidates(team);
      if (cands.length > 0) {
        let i = this.switchIdx[team] % cands.length;
        if (cands[i] === cur.id) i = (i + 1) % cands.length;
        if (cands[i] !== cur.id) this.setControlled(team, cands[i]);
        this.switchIdx[team] = i + 1;
      }
    }
  }
  /** Outfielders sorted by defensive usefulness (cheapest first). */
  private switchCandidates(team: TeamId, exclude = -1): number[] {
    const s = this.state, a = s.attack[team];
    const meet = { x: s.ball.x + s.ball.vx * .18, z: s.ball.z + s.ball.vz * .18 };
    return this.team(team)
      .filter((p) => !p.keeper && p.id !== exclude && p.action !== 'fallen')
      .map((p) => {
        const cost = distance(p, meet) / TUNING.sprint
          + ((p.x - s.ball.x) * a > 0 ? 2 : 0)
          + (p.cooldown > 0 ? 3 : 0)
          + (p.aiState === 'MARK' ? 1.5 : 0);
        return { id: p.id, cost };
      })
      .sort((u, v) => u.cost - v.cost || u.id - v.id)
      .map((c) => c.id);
  }
  /**
   * Responsive arcade movement. Callers pass a desired-velocity vector;
   * acceleration blends toward it (~143ms to 95% speed), release brakes
   * (~120ms stop), and sprint reversals are deliberately heavier. No
   * stamina gate: sprint already costs through longer touches and worse
   * turning (see the touch model in integrateBall).
   */
  private steer(p: Player, wishX: number, wishZ: number, dt: number) {
    if (p.action === 'slide') {
      // Committed slide: glides on locked momentum, input ignored until recovery.
      const decay = Math.exp(-2.2 * dt);
      p.vx *= decay; p.vz *= decay;
      p.x = clamp(p.x + p.vx * dt, -L + .55, L - .55); p.z = clamp(p.z + p.vz * dt, -W + .5, W - .5);
      return;
    }
    if (p.action === 'fallen') {
      // Knocked down: no steering, friction brings the body to rest.
      const decay = Math.exp(-6 * dt);
      p.vx *= decay; p.vz *= decay;
      p.x = clamp(p.x + p.vx * dt, -L + .55, L - .55); p.z = clamp(p.z + p.vz * dt, -W + .5, W - .5);
      return;
    }
    const moving = length(wishX, wishZ) > .05;
    const speedNow = length(p.vx, p.vz);
    // Sprint-class reversals stay heavy for the whole turn (~244ms);
    // ordinary reversals answer in ~183ms.
    const opposing = moving && (p.vx * wishX + p.vz * wishZ) < 0 && length(wishX, wishZ) > 8;
    const rate = moving ? TUNING.acceleration * (opposing ? .72 : 1) : TUNING.deceleration;
    const gain = 1 - Math.exp(-rate * dt);
    p.vx += ((moving ? wishX : 0) - p.vx) * gain;
    p.vz += ((moving ? wishZ : 0) - p.vz) * gain;
    if (moving) {
      const current = Math.atan2(p.facingZ, p.facingX), desired = Math.atan2(wishZ, wishX);
      const delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      const angle = current + delta * (1 - Math.exp(-TUNING.turn * dt));
      p.facingX = Math.cos(angle); p.facingZ = Math.sin(angle);
    }
    p.x = clamp(p.x + p.vx * dt, -L + .55, L - .55); p.z = clamp(p.z + p.vz * dt, -W + .5, W - .5);
  }
  /** Desired-velocity seek with arrival slowdown (AI navigation helper). */
  private seekVelocity(p: Player, tx: number, tz: number, maxSpeed: number, arrive = 0): Vec {
    const dx = tx - p.x, dz = tz - p.z, d = length(dx, dz);
    if (d < 1e-6) return { x: 0, z: 0 };
    const sp = arrive > 0 ? Math.min(maxSpeed, d * arrive) : maxSpeed;
    return { x: dx / d * sp, z: dz / d * sp };
  }
  /**
   * Human locomotion: manual input only. Analog magnitude remaps
   * continuously from the dead zone — no minimum-jog jump, no magnetic
   * receiver steering, no loose-ball bend, no idle drift. The ball is won
   * by physical contact, and the first touch is guided by this same input.
   */
  private moveHumanSide(dt: number, i: InputFrame, team: TeamId) {
    const s = this.state, p = s.players[this.getControlled(team)];
    if (p.keeper) return;
    const mag = length(i.x, i.z);
    const pace = mag <= .07 ? 0 : Math.min(1, (mag - .07) / (1 - .07));
    const top = i.sprint ? TUNING.sprint : TUNING.speed;
    const sp = top * Math.pow(pace, .85);
    if (pace <= 0) { this.steer(p, 0, 0, dt); return; }
    const n = mag || 1;
    this.steer(p, i.x / n * sp, i.z / n * sp, dt);
  }
  /**
   * Persistent responsibilities with hysteresis: the incumbent keeps his
   * role unless a challenger is materially (~20%) better. A human who is
   * actively pressing counts as the presser, so no AI doubles up beside him.
   * Re-evaluated continuously but switching only on material improvement —
   * identities stay stable instead of oscillating several times a second.
   */
  private updateRoles(t: TeamId) {
    const s = this.state, b = s.ball, a = s.attack[t];
    const owner = this.owner(), owns = !!owner && owner.team === t;
    const r = this.roles[t];
    const meet = { x: b.x + b.vx * .16, z: b.z + b.vz * .16 };
    const field = (id: number) => s.players[id];
    const eligible = (id: number) => {
      const p = field(id);
      return !p.keeper && p.action !== 'fallen' && !this.isHumanControlled(id);
    };
    // Human pressing counts as the pressure role.
    let humanPress = false;
    if (!owns && owner && !owner.keeper && (t === s.humanTeam || t === s.remoteTeam)) {
      const h = s.players[this.getControlled(t)];
      if (!h.keeper && h.action !== 'fallen' && distance(h, b) < 5) {
        const closing = (h.vx * (b.x - h.x) + h.vz * (b.z - h.z)) > 0;
        if (h.action === 'tackle' || h.action === 'slide' || closing) humanPress = true;
      }
    }
    if (owns || humanPress || (owner && owner.keeper && owner.team === t)) {
      r.presser = null; r.cover = null;
    } else {
      const cands = this.team(t).filter((p) => eligible(p.id))
        .map((p) => ({ id: p.id, d: distance(p, meet) }))
        .sort((u, v) => u.d - v.d || u.id - v.id);
      const best = cands[0];
      if (!best) { r.presser = null; }
      else if (r.presser === null || !eligible(r.presser)) r.presser = best.id;
      else if (best.id !== r.presser && best.d * 1.2 < distance(field(r.presser), meet)) {
        r.presser = best.id;
      }
      // Cover: nearest goal-side body behind the press, 4–6m back.
      const goal = { x: b.x - a * 5, z: b.z * .7 };
      const covs = this.team(t).filter((p) => eligible(p.id) && p.id !== r.presser)
        .map((p) => ({ id: p.id, d: distance(p, goal) }))
        .sort((u, v) => u.d - v.d || u.id - v.id);
      const cb = covs[0];
      if (!cb) r.cover = null;
      else if (r.cover === null || !eligible(r.cover) || r.cover === r.presser) r.cover = cb.id;
      else if (cb.id !== r.cover && cb.d * 1.2 < distance(field(r.cover), goal)) r.cover = cb.id;
    }
    // One committed forward runner while owning (~1.1s persistence).
    if (owns) {
      const live = r.runner !== null && s.time < r.runnerUntil && eligible(r.runner);
      if (!live) {
        const fwds = this.team(t).filter((p) => eligible(p.id) && !(owner && p.id === owner.id))
          .sort((u, v) => (v.x * a - u.x * a) || u.id - v.id);
        const pick = fwds[0];
        if (pick && pick.x * a > b.x * a - 5) { r.runner = pick.id; r.runnerUntil = s.time + 1.1; }
        else r.runner = null;
      }
    } else { r.runner = null; }
  }
  private updateAI(dt: number, input: InputFrame, peerInput: InputFrame = EMPTY_INPUT) {
    const s = this.state, b = s.ball;
    /** True while the opposing keeper is holding the ball in his hands. */
    const opponentsKeeperHolds = (t: TeamId) => { const o = this.owner(); return !!o && o.keeper && o.team !== t; };
    // If a pass/cross/through is in flight for team t, that receiver owns the
    // chase — teammates hold shape instead of crowding the same ball.
    const activeReceiverTeam: (TeamId | null)[] = [null, null];
    if (this.liveReceiver(this.receiver, this.receiveUntil) && b.owner === null) {
      const rp = s.players[this.receiver as number];
      if (rp) activeReceiverTeam[rp.team] = rp.team;
    }
    if (this.liveReceiver(this.peerReceiver, this.peerReceiveUntil) && b.owner === null) {
      const rp = s.players[this.peerReceiver as number];
      if (rp) activeReceiverTeam[rp.team] = rp.team;
    }
    for (const t of [0, 1] as TeamId[]) {
      const owner = this.owner(), owns = owner ? owner.team === t : b.lastTouch === t;
      const frame = t === s.humanTeam ? input : t === s.remoteTeam ? peerInput : EMPTY_INPUT;
      this.updateRoles(t);
      const a = s.attack[t], r = this.roles[t];
      const buildup = this.buildupUntil > s.time && this.buildupTeam === t && owner?.keeper && owner.team === t;
      // Outlet slots for the buildup phase (deep diagonals + width + second
      // line), assigned by depth order — deterministic, no teleporting.
      let outlets: number[] = [];
      if (buildup) {
        outlets = this.team(t).filter((p) => !p.keeper && !this.isHumanControlled(p.id))
          .sort((u, v) => (u.homeX * a - v.homeX * a) || u.id - v.id)
          .map((p) => p.id);
      }
      for (const p of this.team(t)) {
        if (p.keeper) { this.goalkeeper(p, dt, frame); continue; }
        if (this.isHumanControlled(p.id)) continue;
        if (b.owner === p.id) { this.aiCarrier(p, dt); continue; }
        const role = p.id % 11;
        let tx = p.homeX + a * (clamp(b.x * a * .45, -13, 17) + (owns ? 6 : -2)), tz = p.homeZ + clamp(b.z * .2, -5, 5);
        p.aiState = owns ? 'SUPPORT' : 'DEFEND';
        // A held PASS nominates this player: wait for the release instead of
        // retreating to a support spot (the lead destination keys off his run).
        const heldNominee = this.passNominee[t] === p.id && this.actions[t].action === 'pass'
          && this.actions[t].actorId !== null && this.owner()?.id === this.actions[t].actorId;
        if (heldNominee) { tx = p.x; tz = p.z; p.aiState = 'WAIT'; }
        const lr = this.liveReceiver(this.receiver, this.receiveUntil) && this.receiver === p.id;
        const pr = this.liveReceiver(this.peerReceiver, this.peerReceiveUntil) && this.peerReceiver === p.id;
        if ((lr || pr) && b.owner === null) { const rp = lr ? this.receivePoint : this.peerReceivePoint; tx = rp.x; tz = rp.z; p.aiState = 'CHASE'; }
        else if (buildup && owner) {
          // Keeper distribution: two deep diagonals, width, second line.
          // One opponent may screen a lane; everyone else holds shape.
          const k = owner, oi = outlets.indexOf(p.id);
          if (oi === 0 || oi === 1) {
            tx = k.x + a * 10; tz = clamp(k.z + (oi === 0 ? -9 : 9), -W + 3, W - 3);
            p.aiState = 'OUTLET';
          } else if (oi === 2 || oi === 3) {
            tx = k.x + a * 12; tz = oi === 2 ? -20 : 20;
            p.aiState = 'OUTLET';
          } else if (oi === 4) {
            tx = k.x + a * 18; tz = clamp(k.z * .3, -12, 12);
            p.aiState = 'OUTLET';
          }
        }
        else if (activeReceiverTeam[t] !== null) {
          // Teammate is meeting the pass — hold shape; the cover goalsides.
          if (!owns && p.id === r.cover && b.x * a < -15) { tx = b.x - a * 4; tz = b.z * .65; p.aiState = 'MARK'; }
        }
        else if (!owner && p.id === r.presser) { tx = b.x + b.vx * .14; tz = b.z + b.vz * .14; p.aiState = 'CHASE'; }
        else if (!owns && p.id === r.presser) {
          // The single pressure responsibility: tight when close, goalside
          // contain at distance. Keeper-holding contain handled below.
          const keeperHolds = owner && owner.keeper && owner.team !== t;
          if (keeperHolds) {
            const dx = p.x - b.x, dz = p.z - b.z, d = length(dx, dz) || 1;
            tx = b.x + dx / d * 7; tz = b.z + dz / d * 7;
          }
          else if (distance(p, b) < 3) { tx = b.x + b.vx * .08; tz = b.z + b.vz * .08; }
          else { tx = b.x - a * .45; tz = b.z; }
          p.aiState = 'CHASE';
        }
        else if (!owns && p.id === r.cover) {
          // Cover 4–6m behind the pressure on the goal-side route.
          tx = b.x - a * 5; tz = b.z * .7; p.aiState = 'COVER';
        }
        else if (owner && owner.keeper && owner.team !== t && p.id !== r.presser) {
          // Opponent keeper holding: drop 10m goalside, no press pile.
          tx = clamp(b.x - a * 10, -L + 4, L - 4);
          tz = clamp(p.homeZ * .55 + b.z * .2, -W + 3, W - 3);
          p.aiState = 'RETREAT';
        }
        else if (!owns && role < 5 && !opponentsKeeperHolds(t)) {
          const attacker = this.team(other(t)).filter(q => !q.keeper && Math.abs(q.z - p.homeZ) < 8 && q.x * a < 7).sort((u, v) => u.x * a - v.x * a)[0];
          if (attacker) { tx = Math.min(tx * a, attacker.x * a - 2) * a; tz = p.homeZ * .35 + attacker.z * .65; p.aiState = 'MARK'; }
        }
        if (owns && p.id === r.runner && s.time < r.runnerUntil && p.aiState === 'SUPPORT') {
          // The committed runner stretches beyond the line in his channel.
          tx = a * clamp(b.x * a + 12, -5, L - 7);
          tz = clamp(p.homeZ * .6 + (p.homeZ >= 0 ? 5 : -5), -W + 3, W - 3);
          p.aiState = 'RUN';
        }
        tx = clamp(tx, -L + 4, L - 4); tz = clamp(tz, -W + 3, W - 3);
        const d = distance(p, { x: tx, z: tz });
        const chase = p.aiState === 'CHASE' || p.aiState === 'RUN';
        const w = this.seekVelocity(p, tx, tz, chase ? TUNING.sprint : TUNING.speed, d < 1 ? 5 : 0);
        this.steer(p, w.x, w.z, dt);
        const carrier = this.owner();
        // Only the committed presser challenges: beating him creates a real
        // advantage instead of a second tackler arriving instantly.
        // Keepers handling the ball with their hands can never be tackled.
        if (carrier && !carrier.keeper && carrier.team !== t && p.id === r.presser
          && p.cooldown === 0 && p.think <= 0) {
          const cd = distance(p, carrier);
          if (cd < TUNING.tackleFoot + TUNING.tackleFootR) { this.tackle(p); p.think = .7; }
          else if (cd < 2.7 && length(carrier.vx, carrier.vz) > 7.5) { this.tackle(p, true); p.think = 1.2; }
        }
      }
    }
  }
  private aiCarrier(p: Player, dt: number) {
    const s = this.state, a = s.attack[p.team], goalDistance = distance(p, { x: a * L, z: 0 });
    const foes = this.team(other(p.team)).filter(q => !q.keeper);
    const near = foes.slice().sort((u, v) => distance(u, p) - distance(v, p))[0];
    const pressure = near ? distance(near, p) : 99;
    p.aiState = 'ATTACK';
    // Fixed decision cadence (~3-4Hz): score a few deterministic options —
    // clear shot, wide cross, safe outlet under pressure, lead runner, carry.
    // No per-tick permission rolls; geometry scores every option.
    if (p.think <= 0 && p.cooldown === 0) {
      const goal = { x: a * L, z: 0 };
      const laneOpen = !foes.some((f) => segDist(p, goal, f) < 2.2 && distance(f, p) < goalDistance);
      let best = 6, run: (() => void) | null = null; // carry is the default
      if (goalDistance < 22 && Math.abs(p.z) < 16 && laneOpen) {
        const score = 30 - goalDistance + (goalDistance < 14 ? 6 : 0);
        if (score > best) { best = score; run = () => this.aiShoot(p, goalDistance); };
      }
      if (p.x * a > 17 && Math.abs(p.z) > 16) {
        if (14 > best) { best = 14; run = () => this.cross(p); }
      }
      const runner = this.roles[p.team].runner !== null && s.time < this.roles[p.team].runnerUntil
        ? s.players[this.roles[p.team].runner as number] : null;
      if (runner && (runner.x - p.x) * a > 0) {
        let advantage = 0;
        for (const f of foes) advantage += distance(runner, f) > 3 ? 1 : -1;
        if (advantage > 0 && 16 + advantage > best) {
          best = 16 + advantage;
          run = () => this.pass(p, runner, true, direction(a, runner.z >= 0 ? .3 : -.3));
        }
      }
      if (pressure < 4) {
        const target = this.bestTarget(p, direction(a, p.z > 0 ? -.2 : .2), false);
        if (target && (target.x - p.x) * a > -10) {
          let open = 9;
          for (const f of foes) open = Math.min(open, distance(target, f));
          if (10 + Math.min(open, 5) > best) {
            best = 10 + Math.min(open, 5);
            run = () => this.pass(p, target, false);
          }
        }
      }
      if (run) { run(); p.think = .9; return; }
      p.think = .3;
    }
    let dz = -p.z * .026;
    if (pressure < 4 && (near.x - p.x) * a > 0) dz += (p.z > near.z ? 1 : -1) * .65;
    const cd = direction(a, dz);
    this.steer(p, cd.x * TUNING.speed, cd.z * TUNING.speed, dt);
  }
  /** AI placement: away from the keeper, corner-ish near, higher far. */
  private aiShoot(p: Player, goalDistance: number) {
    const s = this.state;
    if (s.ball.owner !== p.id) return;
    if (s.ball.y > 1.6) return;
    const keeper = s.players[other(p.team) * 11];
    const side = keeper.z >= s.ball.z ? -1 : 1;
    this.strikeShot(
      p,
      side * (goalDistance < 14 ? .62 : .55),
      goalDistance < 12 ? .08 : .3,
      clamp((goalDistance - 8) / 18, .25, 1),
    );
  }
  private goalkeeper(p: Player, dt: number, input: InputFrame = EMPTY_INPUT) {
    const s = this.state, b = s.ball, a = s.attack[p.team], ownGoal = -a * L;
    if (b.owner === p.id) {
      this.keeperHold[p.team] += dt; p.vx = p.vz = 0; p.aiState = 'DISTRIBUTE';
      // Solid keeper cylinder: opponents who run inside 2m are held at the
      // boundary (movement constraint, never a teleport across the pitch).
      for (const q of this.team(other(p.team))) if (!q.keeper) {
        const dx = q.x - p.x, dz = q.z - p.z, d = length(dx, dz);
        if (d < 2) { const n = d > .001 ? d : 1; q.x = p.x + dx / n * 2; q.z = p.z + dz / n * 2; }
      }
      const human = p.team === s.humanTeam || p.team === s.remoteTeam;
      const aim = human && length(input.x, input.z) > .1 ? direction(input.x, input.z) : direction(a, 0);
      let pressure = Infinity;
      for (const q of this.team(other(p.team))) if (!q.keeper) pressure = Math.min(pressure, distance(q, p));
      if (human) {
        // Commanded distribution: aim + PASS/SHOOT edges. A held aim counts
        // as a command (the human is placing the outlet); a totally idle
        // keeper falls back to the AI's safe decision (the 4s-timeout rule:
        // never force a covered short ball, clear long instead).
        // One PASS edge = exactly one distribution; the gesture is consumed so
        // the receiver's fresh possession can never re-fire it (action contract).
        if (length(input.x, input.z) > .1 || input.sprint) this.keeperCmd[p.team] = this.keeperHold[p.team];
        if (input.pass) {
          this.beginAction(p.team, p.id, 'outlet-short', input);
          this.pass(p, this.bestTarget(p, aim, false), false); this.keeperHold[p.team] = 0;
          this.cancelAction(p.team); return;
        }
        if (input.through) { this.pass(p, this.bestTarget(p, aim, true), true); this.keeperHold[p.team] = 0; return; }
        if (input.shootPressed) {
          this.beginAction(p.team, p.id, 'outlet-long', input);
          this.keeperKick(p, aim); this.keeperHold[p.team] = 0;
          this.cancelAction(p.team); return;
        }
        if (this.keeperHold[p.team] > 2.5) {
          if (this.keeperCmd[p.team] > 0) this.pass(p, this.bestTarget(p, aim, false), false);
          else this.keeperDecide(p, pressure, aim);
          this.keeperHold[p.team] = 0;
        }
        return;
      }
      const hurried = pressure < 3.5;
      if (this.keeperHold[p.team] > (hurried ? .28 : .6)) {
        this.keeperDecide(p, pressure, { x: a, z: 0 });
        this.keeperHold[p.team] = 0;
      }
      return;
    }
    this.keeperHold[p.team] = 0;
    this.keeperReact[p.team] = Math.max(0, this.keeperReact[p.team] - dt);
    // Pre-shot: shuffle on the ball-goal angle (arc positioning). Close
    // balls pull the keeper toward the shooter-side post; distant balls
    // keep him central. seekVelocity + 4.5 m/s shuffle, never a teleport.
    const distBall = Math.abs(b.x - ownGoal);
    const tx = ownGoal + a * (2.4 + clamp((L - Math.abs(b.x)) * .035, 0, 1.6));
    let tz = clamp(b.z * clamp(1 - distBall / 40, .25, .8), -3.6, 3.6);
    const dive = this.keeperDive[p.team];
    const diveLive = dive !== null && s.time < dive.until;
    // A shot at my goal, read off live ball physics only.
    const shotAtMe = b.owner === null && b.flight === 'shot' && b.vx * a < -5
      && Math.abs(b.x - ownGoal) < 30;
    if (shotAtMe && this.keeperReact[p.team] <= 0 && !diveLive) {
      // Observation complete (~200ms after release): predict the arrival and
      // commit to at most one bounded dive. Later flight updates refine
      // nothing once committed — no perfect mirroring.
      const pred = this.simCross({ x: b.x, y: b.y, z: b.z }, { x: b.vx, y: b.vy, z: b.vz }, ownGoal);
      const dz = pred.z - p.z;
      p.facingX = 0; p.facingZ = dz >= 0 ? 1 : -1;
      if (Math.abs(dz) > .55 && Math.abs(dz) <= 2.4 && pred.y <= 2.6) {
        const dur = clamp(Math.abs(dz) / TUNING.keeperDiveSpeed, .12, .28);
        this.keeperDive[p.team] = { until: s.time + dur, dx: 0, dz: dz >= 0 ? 1 : -1, sx: p.x, sz: p.z };
        p.action = 'dive'; p.actionTime = dur + .15; p.cooldown = Math.max(p.cooldown, dur + .3);
      }
      // Inside the body radius he holds his ground: contact resolves it.
    }
    p.aiState = shotAtMe ? 'SAVE' : 'GUARD';
    const dv = this.keeperDive[p.team];
    if (dv !== null && s.time < dv.until) {
      // Committed dive: locked direction, bounded displacement (~1.8m max).
      p.vx = dv.dx * TUNING.keeperDiveSpeed; p.vz = dv.dz * TUNING.keeperDiveSpeed;
      p.x = clamp(p.x + p.vx * dt, -L + .55, L - .55); p.z = clamp(p.z + p.vz * dt, -W + .5, W - .5);
      p.action = 'dive'; p.actionTime = Math.max(p.actionTime, dt * 2);
      return;
    }
    if (dv !== null) this.keeperDive[p.team] = null;
    const carrier = this.owner();
    if (!shotAtMe && carrier && carrier.team !== p.team && !carrier.keeper
      && distance(p, b) < 2.0 && length(b.vx, b.vz) < 10 && p.cooldown <= 0) {
      // Smother: a committed physical action, not a claim aura. The keeper
      // throws himself at the feet; contact (see collectBall) decides.
      const d = direction(b.x - p.x, b.z - p.z);
      this.keeperDive[p.team] = { until: s.time + .25, dx: d.x, dz: d.z, sx: p.x, sz: p.z };
      p.action = 'dive'; p.actionTime = .4; p.cooldown = .8;
      return;
    }
    let stx = tx, stz = tz;
    if (!this.owner() && b.y < 1.6) {
      const distGoal = Math.abs(b.x - ownGoal);
      const ballSpeed = length(b.vx, b.vz);
      // Conservative sweeper: gathers slow balls near the box, never a
      // 17m kamikaze run that empties the goal. If the ball is already
      // goal-side of him, cut across it instead of chasing from behind.
      if (ballSpeed < 10 && distGoal < 10 && Math.abs(b.z) < 10) {
        const goalSide = (b.x - p.x) * a < 0;
        stx = clamp(b.x - (goalSide ? a * 1.5 : 0),
          Math.min(ownGoal + a * .5, ownGoal + a * 9), Math.max(ownGoal + a * .5, ownGoal + a * 9));
        stz = clamp(b.z, -8, 8);
      }
    }
    const gw = this.seekVelocity(p, stx, stz, TUNING.keeperSpeed, 6);
    this.steer(p, gw.x, gw.z, dt);
  }

  /**
   * Safe keeper release: an open short outlet goes short; a covered one is
   * cleared long. Used by the AI keeper and by an idle human keeper (the
   * decision-timeout default). Never forces a short ball into pressure.
   */
  private keeperDecide(p: Player, pressure: number, aim: Vec) {
    const s = this.state, a = s.attack[p.team];
    const outlet = this.keeperOutlet(p);
    if (pressure >= 3.5 && outlet) this.pass(p, outlet, false);
    else this.keeperKick(p, aim.x || a ? direction(aim.x || a, aim.z * .5) : direction(a, 0));
  }
  /**
   * A shot needs real foot contact: strike now when the ball is there,
   * buffer briefly when contact is imminent, cancel when it never comes.
   * Never remotely kicks a sprint touch metres ahead.
   */
  private tryStrike(p: Player, team: TeamId, aimU: number, aimV: number, power: number) {
    const s = this.state, b = s.ball;
    const d = distance(p, b);
    // Owned ball: the touch cycle brings foot to ball within ~120ms, so the
    // strike IS the next touch — always available, never "remote".
    if ((b.owner === p.id || d <= 1.2) && b.y < 1.6) {
      this.strikeShot(p, aimU, aimV, power);
      return;
    }
    if (d <= 2.4 && b.y < 1.6 && b.owner === null) {
      this.shotBuf[team] = { actor: p.id, until: this.tick + 9, u: aimU, v: aimV, pow: power };
    }
  }
  private humanActionsSide(dt: number, i: InputFrame, team: TeamId) {
    const peer = team !== this.state.humanTeam;
    const s = this.state, p = s.players[this.getControlled(team)], owner = this.owner();
    // Action contract: a gesture captured on button-down is only valid while
    // its actor still owns the ball. Possession changes never reinterpret a
    // held gesture — invalid gestures are cancelled outright.
    const gesture = this.actions[team];
    if (gesture.actorId !== null && owner?.id !== gesture.actorId) {
      // A held gesture dies with possession: shot charges AND pass holds.
      const wasPass = gesture.action === 'pass';
      this.cancelAction(team);
      this.cancelShot(peer);
      this.passNominee[team] = null;
      if (wasPass && !this.liveReceiver(this.receiver, this.receiveUntil)
        && !this.liveReceiver(this.peerReceiver, this.peerReceiveUntil)) {
        this.setTarget(team, null);
      }
    }
    // Buffered first-time strike: fire when the foot arrives, expire after ~150ms.
    const buf = this.shotBuf[team];
    if (buf) {
      const bp = s.players[buf.actor];
      if (this.tick > buf.until || bp.action === 'fallen') this.shotBuf[team] = null;
      else if (distance(bp, s.ball) <= 1.2 && s.ball.y < 1.6
        && (s.ball.owner === null || s.ball.owner === bp.id)) {
        this.strikeShot(bp, buf.u, buf.v, buf.pow);
        this.shotBuf[team] = null;
      }
    }
    // Kaleci topu elinde tutarken tuşlar kaleciye aittir; sahadaki oyuncu dalmaz.
    if (owner && owner.keeper && owner.team === team) { this.cancelShot(peer); return; }
    const raw = length(i.x, i.z) > .05 ? direction(i.x, i.z) : direction(p.facingX, p.facingZ);
    const charge = peer ? this.peerCharge : this.charge;
    const charging = peer ? this.peerChargingPlayer : this.chargingPlayer;
    const setCharge = (v: number) => { if (peer) this.peerCharge = v; else { this.charge = v; s.charge = v; } };
    const setCharging = (v: number | null) => { if (peer) this.peerChargingPlayer = v; else this.chargingPlayer = v; };
    if (owner?.id === p.id) {
      // PASS tap = to feet, PASS hold (~183ms) = into space for the SAME
      // receiver. The press locks intent (nominee + aim); the release fixes
      // the destination and kicks. Losing the ball mid-hold cancels.
      const passOpen = this.actions[team].action === 'pass' && this.actions[team].actorId === p.id;
      if (i.pass) {
        const nominee = this.selectPassTarget(p, raw);
        this.passNominee[team] = nominee?.id ?? null;
        this.passAim[team] = { ...raw };
        this.beginAction(team, p.id, 'pass', i);
        this.setTarget(team, nominee?.id ?? null);
        // Intent window: keeps the target marker alive in recover() while
        // the button is held. The receiver triple itself is only armed on
        // release (releasePass), so AI shape never chases a held button.
        if (team === s.humanTeam) {
          if (!this.liveReceiver(this.receiver, this.receiveUntil)) this.receiveUntil = s.time + 1.0;
        } else if (!this.liveReceiver(this.peerReceiver, this.peerReceiveUntil)) {
          this.peerReceiveUntil = s.time + 1.0;
        }
        this.cancelShot(peer);
        return;
      }
      if (passOpen) {
        if (i.shootPressed) { this.cancelAction(team); this.passNominee[team] = null; this.setTarget(team, null); }
        else {
          const heldTicks = this.tick - this.actions[team].startedTick;
          if (i.passReleased || !i.passHeld || heldTicks > 45) {
            const lead = i.passReleased && heldTicks >= PASS_LEAD_TICKS;
            this.releasePass(p, team, lead);
            this.cancelShot(peer); this.cancelAction(team);
          } else this.setTarget(team, this.passNominee[team]);
          return;
        }
      }
      if (i.shootPressed) { this.beginAction(team, p.id, 'shot', i); setCharge(0); setCharging(p.id); }
      if (i.shootHeld && charging === p.id) setCharge(Math.min(.45, charge + dt));
      if ((i.shootReleased && charging === p.id) || (charging === p.id && charge >= .45)) {
        // Release without an active charge (cancelled gesture) does nothing.
        if (charging !== p.id || this.actions[team].action !== 'shot') { this.cancelShot(peer); this.cancelAction(team); return; }
        // Power = hold duration (0–450ms); placement = live drag aim, or a
        // quick low finish on the release facing when untouched.
        const power = clamp(charge / .45, 0, 1);
        this.cancelShot(peer); this.cancelAction(team);
        this.tryStrike(p, team, i.aimU, i.aimV, power);
      }
    } else {
      this.cancelShot(peer);
      // A release edge alone is never an action: without a preceding press it
      // cannot become a shot — and it must never become a defensive slide.
      if (i.shootPressed && !owner && distance(p, s.ball) < 2.4 && s.ball.y < 2.6) {
        this.tryStrike(p, team, i.aimU, i.aimV, .4);
        if (s.ball.flight === 'shot' && s.ball.lastKicker === p.id) {
          s.message = s.ball.y > 1.25 ? 'HEADER!' : 'FIRST TIME!'; s.messageTime = .7;
        }
      }
      // Modern ayrım: S = kademeli/standing tackle, D = kayarak/slide müdahale.
      else if (i.pass) { this.beginAction(team, p.id, 'challenge', i); this.tackle(p, false); this.cancelAction(team); }
      else if (i.shootPressed) { this.beginAction(team, p.id, 'slide', i); this.tackle(p, true); this.cancelAction(team); }
    }
  }
  private cancelShot(peer = false) {
    if (peer) { this.peerCharge = 0; this.peerChargingPlayer = null; }
    else { this.charge = 0; this.chargingPlayer = null; this.state.charge = 0; }
  }
  private bestTarget(p: Player, aim: Vec, through: boolean): Player | null {
    let target: Player | null = null, best = -Infinity;
    const foes = this.team(other(p.team));
    for (const q of this.team(p.team)) if (q.id !== p.id && !q.keeper) {
      const dx = q.x - p.x, dz = q.z - p.z, d = length(dx, dz); if (d < 2 || d > 37) continue;
      // Şerit skorlaması (FC 26 pas şeridi): nişan ışınına dikey sapma cezalı,
      // ileri-bias yok — geriye/yana nişanlanan pas geriye/yana gider.
      const alignment = (dx * aim.x + dz * aim.z) / (d || 1);
      const lane = Math.abs(dx * aim.z - dz * aim.x);
      let danger = 0, open = 9;
      for (const f of foes) {
        open = Math.min(open, distance(q, f));
        const u = ((f.x - p.x) * dx + (f.z - p.z) * dz) / (d * d);
        if (u > .12 && u < .9 && distance(f, { x: p.x + u * dx, z: p.z + u * dz }) < 1.5) danger += 1.8;
      }
      const value = alignment * 12 - lane * 1.1 - Math.abs(d - (through ? 19 : 13)) * .085 + Math.min(open, 5) * .2 - danger;
      if (value > best) { best = value; target = q; }
    }
    return target;
  }
  private selectPassTarget(p: Player, aim: Vec): Player | null {
    // Aim-cone selection: nobody behind the intended direction is ever
    // picked; holding PASS longer never changes the receiver, only the
    // destination (feet vs space, decided at release).
    let target: Player | null = null, best = -Infinity;
    const foes = this.team(other(p.team));
    for (const q of this.team(p.team)) {
      if (q.id === p.id || q.keeper) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = length(dx, dz);
      if (d < 2 || d > 37) continue;
      const alignment = (dx * aim.x + dz * aim.z) / (d || 1);
      if (alignment < PASS_CONE) continue;
      const lane = Math.abs(dx * aim.z - dz * aim.x);
      let danger = 0, open = 9;
      for (const f of foes) {
        open = Math.min(open, distance(q, f));
        const u = ((f.x - p.x) * dx + (f.z - p.z) * dz) / (d * d);
        if (u > .12 && u < .9 && distance(f, { x: p.x + u * dx, z: p.z + u * dz }) < 1.5) danger += 1.8;
      }
      const value = alignment * 12 - lane * 1.1 - Math.abs(d - 13) * .085 + Math.min(open, 5) * .2 - danger
        + (this.roles[p.team].runner === q.id && this.state.time < this.roles[p.team].runnerUntil ? 2 : 0);
      if (value > best) { best = value; target = q; }
    }
    return target;
  }
  /** Release a held PASS: one gesture, one kick, destination fixed now. */
  private releasePass(p: Player, team: TeamId, lead: boolean) {
    const s = this.state;
    const id = this.passNominee[team];
    const nominee = id !== null ? s.players[id] : null;
    this.passNominee[team] = null;
    const valid = nominee && nominee.team === p.team && !nominee.keeper ? nominee : null;
    this.pass(p, valid, lead, this.passAim[team]);
  }
  private pass(p: Player, q: Player | null, lead: boolean, aim?: Vec) {
    const s = this.state;
    // Keeper release ends the buildup window: normal pressure returns, no
    // invulnerability and no teleporting anyone away.
    if (p.keeper) this.buildupUntil = 0;
    if (!q) {
      // No candidate inside the aim cone: manual directional ball, no nominee.
      const d = aim && length(aim.x, aim.z) > .05 ? direction(aim.x, aim.z) : direction(p.facingX, p.facingZ);
      this.kick(p, d, 18, .3, 'pass');
      this.setTarget(p.team, null);
      s.stats.passes[p.team]++;
      return;
    }
    const d = distance(p, q);
    const speed = clamp(14 + d * .55, 18, 26);
    const flightTime = d / speed;
    let tx = q.x + q.vx * .25, tz = q.z + q.vz * .25;
    let flight: Ball['flight'] = 'pass', vy = .2;
    if (lead) {
      // Into space: carry the runner's velocity over the flight time, plus a
      // 3–6m serving lead along the run. Fixed at release — never steered after.
      const run = length(q.vx, q.vz) > 1 ? direction(q.vx, q.vz)
        : aim && length(aim.x, aim.z) > .05 ? direction(aim.x, aim.z) : direction(p.facingX, p.facingZ);
      const leadDist = clamp(3 + d * .08, 3, 6);
      tx = q.x + q.vx * flightTime * .9 + run.x * leadDist;
      tz = q.z + q.vz * flightTime * .9 + run.z * leadDist;
      flight = 'through'; vy = .45;
    }
    tx = clamp(tx, -L + 3, L - 3); tz = clamp(tz, -W + 2, W - 2);
    this.kick(p, direction(tx - s.ball.x, tz - s.ball.z), speed, vy, flight);
    // Nominate, don't transfer: control follows on confirmed possession
    // (firstTouch), so mid-flight the kicker stays selected and a manual
    // SWITCH can take the runner early.
    this.receiver = q.id; this.receivePoint = { x: tx, z: tz }; this.receiveUntil = s.time + 2.7;
    this.setReceiver(p.team, q.id, { x: tx, z: tz }, s.time + 2.7);
    s.stats.passes[p.team]++;
  }
  private cross(p: Player, aim?: Vec) {
    const s = this.state, a = s.attack[p.team];
    const wideAttack = p.x * a > 5 && Math.abs(p.z) > 10;
    let target = this.team(p.team).filter(q => !q.keeper && q.id !== p.id).sort((u, v) => (v.x * a - Math.abs(v.z) * .6) - (u.x * a - Math.abs(u.z) * .6))[0];
    let tx = wideAttack ? a * (L - 9) : (target?.x ?? p.x + a * 16) + a * 3;
    let tz = wideAttack ? clamp((aim?.z ?? 0) * 3, -4, 4) : (target?.z ?? 0);
    tx = clamp(tx, -L + 5, L - 5); tz = clamp(tz, -W + 4, W - 4);
    target = this.nearest(p.team, { x: tx, z: tz }, p.id);
    const d = distance(s.ball, { x: tx, z: tz }), flightTime = clamp(d / 20, 1.0, 1.8);
    this.kick(p, direction(tx - s.ball.x, tz - s.ball.z), d / flightTime * 1.07, 9 * flightTime, 'cross');
    this.receiver = target.id; this.receivePoint = { x: tx, z: tz }; this.receiveUntil = s.time + flightTime + 1.5;
    this.setReceiver(p.team, target.id, { x: tx, z: tz }, s.time + flightTime + 1.5);
    this.setControlled(p.team, target.id);
  }
  /** Kaleci uzun topu: nişan yönündeki en uygun arkadaş hedeflenir, top havadan yumuşak iner. */
  private keeperKick(p: Player, aim: Vec) {
    const s = this.state;
    this.buildupUntil = 0; // long clearance ends the buildup like any release
    let target: Player | null = null, best = -Infinity;
    for (const q of this.team(p.team)) if (q.id !== p.id && !q.keeper) {
      const dx = q.x - p.x, dz = q.z - p.z, d = length(dx, dz); if (d < 5 || d > 40) continue;
      const v = ((dx * aim.x + dz * aim.z) / (d || 1)) * 10 - Math.abs(d - 26) * .12;
      if (v > best) { best = v; target = q; }
    }
    const tx = clamp(target ? target.x + target.vx * .35 : p.x + aim.x * 26, -L + 3, L - 3);
    const tz = clamp(target ? target.z + target.vz * .35 : p.z + aim.z * 26, -W + 2, W - 2);
    const dd = distance(s.ball, { x: tx, z: tz }), ft = clamp(dd / 20, 1.0, 1.8);
    this.kick(p, direction(tx - s.ball.x, tz - s.ball.z), dd / ft * 1.07, 8 * ft, 'cross');
    const rec = target ?? this.nearest(p.team, { x: tx, z: tz }, p.id);
    this.receiver = rec.id; this.receivePoint = { x: tx, z: tz }; this.receiveUntil = s.time + ft + 1.5;
    this.setReceiver(p.team, rec.id, { x: tx, z: tz }, s.time + ft + 1.5);
  }
  /**
   * Dedicated keeper short-outlet selection (never the generic pass cone):
   * the most open of the deep diagonal outlets 8–14m out. Covered outlets
   * return null so the keeper clears long instead of forcing it.
   */
  private keeperOutlet(p: Player): Player | null {
    const s = this.state, a = s.attack[p.team];
    let best: Player | null = null, bestScore = -Infinity;
    for (const q of this.team(p.team)) {
      if (q.id === p.id || q.keeper) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = length(dx, dz);
      if (d < 6 || d > 18) continue;
      // Outlet shape: ahead-diagonal of the keeper, not square or behind.
      const ahead = (dx * a) / (d || 1);
      if (ahead < .3) continue;
      let cover = 0;
      for (const f of this.team(other(p.team))) {
        if (distance(f, q) < 3.5) cover += 2;
        const u = ((f.x - p.x) * dx + (f.z - p.z) * dz) / (d * d);
        if (u > .15 && u < .85 && distance(f, { x: p.x + u * dx, z: p.z + u * dz }) < 1.6) cover += 2.5;
      }
      const score = ahead * 6 - Math.abs(d - 11) * .5 - cover;
      if (score > bestScore) { bestScore = score; best = q; }
    }
    return bestScore > -4 ? best : null;
  }
  /**
   * ONE shoot action: placement (goal-local U across, V height) + power.
   * No automatic finesse, no sprint-driven variant, no random spread, no
   * movement-steered aim while charging. Power sets shot speed only —
   * placement is solved independently against real gravity + drag, so a
   * harder strike lands in the same sector on a flatter arc.
   */
  private strikeShot(p: Player, aimU: number, aimV: number, power01: number) {
    const s = this.state, a = s.attack[p.team], gx = a * L;
    let tz: number, ty: number;
    if (aimU === 0 && aimV === 0) {
      // No drag: quick low finish on the release facing, inside the posts.
      tz = clamp(s.ball.z + p.facingZ * 6, -3.5, 3.5); ty = .4;
    } else {
      // Full-range reticle: |U|>~0.85 lands outside the posts, V>~0.87 over
      // the bar — the UI draws those boundaries so misses are deliberate.
      tz = clamp(aimU, -1, 1) * (FIELD.goalHalfWidth + .8); ty = .2 + clamp(aimV, 0, 1) * 3.0;
    }
    // Pressure mishit (deterministic, readable): a marker within ~1.8m
    // scuffs the strike instead of secretly moving the placement.
    let near = Infinity;
    for (const f of this.team(other(p.team))) if (!f.keeper) near = Math.min(near, distance(f, p));
    const speed = (25 + clamp(power01, 0, 1) * 10) * clamp((near - .6) / 1.2, .5, 1);
    const v = this.solveShot({ x: s.ball.x, y: s.ball.y, z: s.ball.z }, gx, tz, ty, speed);
    this.launch(p, v.x, v.y, v.z, 'shot');
    // Keeper gets a flat 200ms observation beat (P0.4b commits off physics).
    this.keeperReact[other(p.team)] = .2;
  }
  /** Launch velocity whose integrated goal-plane crossing hits (gx, tz, ty).
   *  Fixed-iteration numerical solve against the sim's own gravity + drag:
   *  bisect vy for height, then rescale horizontal for drag loss (×3). */
  private solveShot(from: { x: number; y: number; z: number }, gx: number, tz: number, ty: number, speed: number): { x: number; y: number; z: number } {
    const dx = gx - from.x, dz = tz - from.z;
    const dist = Math.hypot(dx, dz) || 1;
    const v = { x: dx / dist * speed, y: ty > .8 ? 3.5 : .9, z: dz / dist * speed };
    const fitHeight = () => {
      let lo = -2, hi = 12;
      for (let j = 0; j < 8; j++) {
        const c = this.simCross(from, v, gx);
        if (c.y < ty) lo = v.y; else hi = v.y;
        v.y = (lo + hi) / 2;
      }
    };
    fitHeight();
    for (let i = 0; i < 3; i++) {
      const c = this.simCross(from, v, gx);
      const gl = Math.hypot(gx - from.x, c.z - from.z) || 1;
      const k = dist / gl;
      v.x *= k; v.z *= k;
      fitHeight();
    }
    v.y = clamp(v.y, -2, 10);
    return { x: v.x, y: v.y, z: v.z };
  }
  /** Forward-simulate (sim gravity + drag, 120Hz) to the x=gx plane crossing. */
  private simCross(from: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }, gx: number): { z: number; y: number } {
    let x = from.x, y = from.y, z = from.z, vx = v.x, vy = v.y, vz = v.z;
    const dt = 1 / 120;
    for (let i = 0; i < 480; i++) {
      const px = x, py = y, pz = z;
      y += vy * dt; vy -= 18 * dt;
      if (y <= R) { y = R; vy = vy < -1.1 ? -vy * .32 : 0; }
      const drag = Math.exp(-(y > R + .05 ? .075 : .58) * dt);
      vx *= drag; vz *= drag;
      x += vx * dt; z += vz * dt;
      if ((px - gx) * (x - gx) <= 0) {
        const u = clamp((gx - px) / ((x - px) || 1e-6), 0, 1);
        return { z: pz + (z - pz) * u, y: py + (y - py) * u };
      }
    }
    return { z, y };
  }
  private kick(p: Player, d: Vec, speed: number, vy: number, flight: Ball['flight']) {
    this.launch(p, d.x * speed, vy, d.z * speed, flight);
  }
  /** Raw-vector launch with the standard kick bookkeeping (ownership release,
   *  lock, cooldown, receiver clearing, events, stats). */
  private launch(p: Player, vx: number, vy: number, vz: number, flight: Ball['flight']) {
    const b = this.state.ball;
    b.owner = null; b.lock = .12; b.lastTouch = p.team; b.lastKicker = p.id;
    b.vx = vx; b.vz = vz; b.vy = vy; b.flight = flight; b.spin = 0;
    p.cooldown = .25; p.action = 'kick'; p.actionTime = .25;
    this.receiver = null; this.clearReceiver(p.team);
    this.events.push({ type: flight === 'shot' ? 'shot' : 'kick', team: p.team, power: Math.hypot(vx, vz) });
    if (flight === 'shot') this.state.stats.shots[p.team]++;
  }
  /**
   * Challenge initiator: sets the commitment, never the outcome. Standing =
   * a short lunge window resolved per-tick below; slide = a locked-direction
   * glide resolved THROUGHOUT the active phase (launching outside range and
   * sliding into the ball wins). No RNG: geometry decides every contact.
   */
  private tackle(p: Player, slide = false) {
    if (p.cooldown > 0 || p.action === 'fallen') return;
    const b = this.state.ball;
    const toBall = direction(b.x - p.x, b.z - p.z);
    if (length(b.x - p.x, b.z - p.z) > .05) {
      // Bounded aim assistance: turn toward the ball, then lock (slide) or
      // lunge (standing). Standing ~25°, slide ~30° of help, no more.
      const cur = Math.atan2(p.facingZ, p.facingX), want = Math.atan2(toBall.z, toBall.x);
      const delta = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      const help = slide ? .52 : .44;
      const turn = clamp(delta, -help, help);
      p.facingX = Math.cos(cur + turn); p.facingZ = Math.sin(cur + turn);
    }
    if (slide) {
      p.cooldown = 1.0; p.action = 'slide'; p.actionTime = TUNING.slideTotal;
      p.vx = p.facingX * 8; p.vz = p.facingZ * 8;
      this.slideSrc[p.id] = { x: p.x, z: p.z };
    } else {
      p.cooldown = .5; p.action = 'tackle'; p.actionTime = .32;
    }
  }
  /**
   * Per-tick challenge resolution, after ball physics: foot capsule for
   * standing lunges, swept body capsule for live slides. Contact knocks the
   * ball loose with a physical deflection — never a direct ownership
   * transfer, never immunity, never dice.
   */
  private resolveChallenges() {
    const s = this.state, b = s.ball;
    if (b.lock > 0 || b.y > 1.1) return;
    for (const p of s.players) {
      if (p.keeper) continue;
      const owner = b.owner !== null ? s.players[b.owner] : null;
      if (owner && (owner.team === p.team || owner.keeper)) continue;
      if (p.action === 'tackle' && p.actionTime > 0) {
        // Foot sweep from the body through the lunge point: chest-to-chest
        // contact wins as well as extended reaches. Grazes glance off.
        // A slow loose ball at the feet is gathered, never whacked (no
        // lunging own goals); fast loose balls still deflect physically.
        const fx = p.x + p.facingX * TUNING.tackleFoot, fz = p.z + p.facingZ * TUNING.tackleFoot;
        const d = segDist(p, { x: fx, z: fz }, b);
        if (d < TUNING.tackleFootR && (owner === null || owner.team !== p.team)) {
          const speed = length(b.vx, b.vz);
          if (owner === null && speed < 8 && b.y < 1.0) { this.firstTouch(p); continue; }
          const full = d < .45;
          const pop = (full ? 5.5 : 2.5);
          b.owner = null; b.lock = .14; b.lastTouch = p.team;
          b.lastKicker = owner ? owner.id : b.lastKicker;
          b.vx = p.facingX * pop + p.vx * .3; b.vz = p.facingZ * pop + p.vz * .3;
          b.vy = full ? .7 : .4; b.flight = 'roll'; b.spin = 0;
          p.actionTime = Math.min(p.actionTime, .05);
          this.receiver = null; if (owner) this.clearReceiver(owner.team);
          s.stats.tackles[p.team]++; this.events.push({ type: 'tackle', team: p.team, slide: false, power: full ? 5 : 2 });
        }
      } else if (p.action === 'slide') {
        const src = this.slideSrc[p.id];
        const active = src !== null && p.actionTime > TUNING.slideTotal - TUNING.slideActive;
        if (!active) { if (p.actionTime <= 0 && src) this.slideSrc[p.id] = null; continue; }
        if (segDist(src!, p, b) < TUNING.slideSweepR && (owner === null || owner.team !== p.team)) {
          // Ball-first contact wins the ball with a physical deflection; a
          // body follow-through floors the victim briefly. Missing the ball
          // entirely (body only) is just a foul-free bump: play on.
          b.owner = null; b.lock = .14; b.lastTouch = p.team;
          b.lastKicker = owner ? owner.id : b.lastKicker;
          const sp = length(p.vx, p.vz);
          const dx = sp > .5 ? p.vx / sp : p.facingX, dz = sp > .5 ? p.vz / sp : p.facingZ;
          b.vx = dx * 7 + p.vx * .2; b.vz = dz * 7 + p.vz * .2; b.vy = .8; b.flight = 'roll'; b.spin = 0;
          if (owner && distance(owner, b) < 1.4) {
            owner.action = 'fallen'; owner.actionTime = .6; owner.cooldown = Math.max(owner.cooldown, .8);
            owner.vx *= .2; owner.vz *= .2;
          }
          this.slideSrc[p.id] = null; // one hit per slide
          this.receiver = null; if (owner) this.clearReceiver(owner.team);
          s.stats.tackles[p.team]++; this.events.push({ type: 'tackle', team: p.team, slide: true, power: 8 });
        }
      }
    }
  }
  private separatePlayers() {
    const ps = this.state.players;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const p = ps[i], q = ps[j], dx = p.x - q.x, dz = p.z - q.z, d = length(dx, dz);
      if (d < .72 && d > .001) {
        const push = (.72 - d) * .24;
        p.x += dx / d * push; p.z += dz / d * push; q.x -= dx / d * push; q.z -= dz / d * push;
      }
    }
  }
  private integrateBall(dt: number) {
    const b = this.state.ball, owner = this.owner();
    this.previousBall = { x: b.x, z: b.z, y: b.y }; b.lock = Math.max(0, b.lock - dt);
    if (owner) this.dribbleTouch(owner, dt);
    b.y += b.vy * dt; b.vy -= 18 * dt;
    if (b.y <= R) { b.y = R; b.vy = b.vy < -1.1 ? -b.vy * .32 : 0; }
    // Magnus: spin bends the flight path sideways (curlers); decays in air,
    // weaker through grass. Tolerant of snapshots that predate `spin`.
    const spin = b.spin || 0;
    if (spin) {
      const sp = length(b.vx, b.vz);
      if (sp > 4) {
        const eff = spin * (b.y > R + .05 ? 1 : .55) * dt;
        const ax = -b.vz / sp * eff, az = b.vx / sp * eff;
        b.vx += ax; b.vz += az;
      }
      b.spin = spin * Math.exp(-.45 * dt);
    }
    const drag = Math.exp(-(b.y > R + .05 ? .075 : .58) * dt);
    b.vx *= drag; b.vz *= drag;
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (!this.owner()) this.goalFrameCollision();
  }
  /**
   * Physical ball control. `owner` means "entitled to controlled touches" —
   * never a magnet. Between discrete touches (every ~120ms) the ball runs
   * ordinary physics and can be won by anyone it physically reaches.
   * Sprinting visibly pushes the ball farther ahead (and exposes it).
   */
  private dribbleTouch(owner: Player, dt: number) {
    const b = this.state.ball;
    if (owner.keeper) {
      // Keeper hands: a committed carry, pinned — never a magnetic dribble.
      // Far-away "ownership" is corrupt state: release, never teleport.
      if (distance(owner, b) > 2 || b.y > 2.5) {
        b.owner = null; b.lock = Math.max(b.lock, .06);
        return;
      }
      b.x = owner.x + owner.facingX * .55; b.z = owner.z + owner.facingZ * .55;
      b.y = R; b.vx = owner.vx; b.vz = owner.vz; b.vy = 0;
      owner.touchIn = TUNING.touchGap;
      return;
    }
    owner.touchIn -= dt;
    const dist = distance(owner, b);
    if (b.y > 1.2 || dist > TUNING.envelope || owner.action === 'fallen') {
      // Not controllable: release with no teleport and no rocket — the ball
      // simply continues under its own physics from where it is.
      b.owner = null; b.lock = Math.max(b.lock, .06);
      return;
    }
    if (owner.touchIn > 0 || b.y > 1.0) return;
    const speed = length(owner.vx, owner.vz);
    const sprinting = speed > (TUNING.speed + TUNING.sprint) / 2;
    const ahead = sprinting ? TUNING.touchSprint : TUNING.touchJog;
    const travel = speed > .5
      ? { x: owner.vx / speed, z: owner.vz / speed }
      : { x: owner.facingX, z: owner.facingZ };
    // Bounded correction toward the touch point, added to carrier velocity.
    const corr = 4.5;
    b.vx = owner.vx + clamp(owner.x + travel.x * ahead - b.x, -1, 1) * corr;
    b.vz = owner.vz + clamp(owner.z + travel.z * ahead - b.z, -1, 1) * corr;
    owner.touchIn = TUNING.touchGap;
  }
  private goalFrameCollision() {
    const b = this.state.ball, prev = this.previousBall;
    for (const sign of [-1, 1]) {
      const plane = sign * L, dx = b.x - prev.x;
      if (Math.abs(dx) < .001 || (b.x * sign < L - .34 && prev.x * sign < L - .34)) continue;
      const u = clamp((plane - prev.x) / dx, 0, 1), z = prev.z + (b.z - prev.z) * u, y = prev.y + (b.y - prev.y) * u;
      if (Math.min(Math.abs(prev.x - plane), Math.abs(b.x - plane)) > .4 && (prev.x - plane) * (b.x - plane) > 0) continue;
      const post = Math.abs(Math.abs(z) - FIELD.goalHalfWidth) < .33 && y < FIELD.goalHeight + .2;
      const bar = Math.abs(y - FIELD.goalHeight) < .33 && Math.abs(z) < FIELD.goalHalfWidth + .2;
      if (post || bar) {
        b.x = plane - Math.sign(b.vx) * .42; b.vx *= -.74;
        if (bar) b.vy = -Math.abs(b.vy) * .55; else b.vz += Math.sign(z) * 1.5;
        b.lock = .06; this.events.push({ type: 'post' }); return;
      }
    }
  }
  private collectBall(dt: number) {
    const s = this.state, b = s.ball;
    // Smother strip: a live keeper dive that reaches an opponent's ball
    // knocks it loose (tackle-like, never a vacuum claim). The pop goes
    // outward from the keeper's goal — never back across it. The loose ball
    // is gathered by the normal contact below on a later tick.
    if (b.owner !== null && b.lock <= 0) {
      const op = s.players[b.owner];
      if (op && !op.keeper) {
        for (const t of [0, 1] as TeamId[]) {
          if (op.team === t) continue;
          const p = s.players[t * 11], a = s.attack[t];
          const dive = this.keeperDive[t];
          if (!dive || s.time >= dive.until || b.y > 1.2) continue;
          if (segDist({ x: dive.sx, z: dive.sz }, p, b) >= TUNING.keeperHand) continue;
          b.owner = null; b.lock = .12; b.lastTouch = t; b.lastKicker = op.id;
          b.vx = a * 2.5 + p.vx * .1; b.vz = (b.z >= p.z ? 1 : -1) * 2 + p.vz * .1;
          b.vy = .8; b.flight = 'roll'; b.spin = 0;
          s.stats.saves[t]++; this.events.push({ type: 'save', team: t });
          return;
        }
      }
    }
    if (b.owner !== null || b.lock > 0) return;
    // Keeper contact: real body/hand volumes + the swept dive capsule. A shot
    // inside the reaction window is unreadable: no contact at all (he has not
    // seen it yet). Comfortable takes are caught; stretched or powerful
    // contact parries into a live rebound — never an instant re-catch.
    for (const t of [0, 1] as TeamId[]) {
      const p = s.players[t * 11], a = s.attack[t];
      if (b.owner === p.id) continue;
      if (Math.abs(p.x + a * L) > 12 || (b.x - p.x) * a < -.8) continue;
      const speed = length(b.vx, b.vz), isShot = b.flight === 'shot';
      if (isShot && this.keeperReact[t] > 0) continue;
      const dive = this.keeperDive[t];
      const diving = dive !== null && s.time < dive.until;
      const ceiling = diving ? 2.6 : 2.0;
      if (b.y > ceiling) continue;
      const touch = diving
        ? segDist({ x: dive.sx, z: dive.sz }, p, b) < TUNING.keeperHand
        : distance(p, b) < TUNING.keeperBody;
      if (!touch) continue;
      const stretch = Math.abs(b.z - p.z);
      s.stats.saves[t]++; this.events.push({ type: 'save', team: t });
      b.lastTouch = t;
      // Placement-aware take: comfortable body contact holds anything but a
      // rocket; edge contact holds tame efforts; everything stretched or
      // fierce parries into a live rebound — never an instant re-catch.
      const comfy = stretch < .5 && b.y < 1.5;
      const edge = stretch < .8 && b.y < 1.8;
      if (!isShot && speed < 8) { this.keeperClaim(p); return; }
      if (comfy && speed < 27) { this.keeperClaim(p); return; }
      if (edge && !comfy && speed < 24) { this.keeperClaim(p); return; }
      // Parry: beat it away from the goal mouth, never back across it. The
      // outward component dominates; keeper momentum only shapes it.
      // Deterministic; the rebound stays contestable.
      b.owner = null; b.spin = 0;
      b.vx = a * (3 + speed * .25) + p.vx * .15;
      b.vz = (b.z >= p.z ? 1 : -1) * (3.5 + speed * .18) + p.vz * .15;
      b.vy = 2.2; b.lock = .25; b.flight = 'roll';
      p.cooldown = Math.max(p.cooldown, .4);
      return;
    }
    if (b.y > 1.05) return;
    // Swept physical contact: the ball's segment this tick against every
    // outfielder, so fast balls cannot tunnel through a body. One small
    // acquisition radius for everyone — nominated receivers get no bonus.
    // Contested balls go to the closest contact; exact overlaps break by
    // lower player id (stable, deterministic, no RNG).
    let best: Player | null = null, bestScore = Infinity;
    for (const p of s.players) {
      if (p.keeper || p.action === 'fallen') continue;
      if (segDist(this.previousBall, b, p) >= TUNING.acquire) continue;
      const score = distance(p, b) + p.id * 1e-4;
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (best) {
      const fastShot = b.flight === 'shot' && length(b.vx, b.vz) > 19;
      if (fastShot) {
        // A rocket cannot be controlled: deterministic block deflection.
        b.vx *= -.28; b.vz += (b.z >= best.z ? 1 : -1) * 3.5; b.vy = 1.4;
        b.lock = .18; b.lastTouch = best.team; b.flight = 'roll';
      } else this.firstTouch(best);
    }
  }
  /**
   * Reception without teleport: the ball stays where contact happened and
   * keeps a fraction of its motion. Easy balls settle at the feet; hot or
   * awkward balls skip ahead and must be gathered — a meaningful first
   * touch, guided implicitly by the receiver's movement (facing/velocity
   * steer the immediate settling touch in dribbleTouch).
   */
  private firstTouch(p: Player) {
    const b = this.state.ball, s = this.state;
    const incoming = length(b.vx, b.vz);
    const spill = clamp((incoming - 10) * .12, 0, 1);
    const keep = .12 + spill * .3;
    b.vx = p.vx * .55 + b.vx * keep;
    b.vz = p.vz * .55 + b.vz * keep;
    if (b.y > R + .02) b.vy = Math.min(b.vy, 1);
    b.owner = p.id; b.lastTouch = p.team; b.flight = 'roll';
    p.touchIn = 0;
    p.think = Math.max(p.think, .5);
    this.receiver = null; this.peerReceiver = null; s.targetPlayer = null; s.peerTarget = null;
    this.setControlled(p.team, p.id);
  }
  private keeperClaim(p: Player) {
    const b = this.state.ball, s = this.state;
    // Hands claim: damp in place, no teleport to the feet.
    b.owner = p.id; b.lastTouch = p.team; b.flight = 'roll';
    b.vx = 0; b.vz = 0; b.vy = 0; if (b.y < R) b.y = R;
    p.touchIn = TUNING.touchGap; p.think = Math.max(p.think, .5);
    this.receiver = null; this.peerReceiver = null; s.targetPlayer = null; s.peerTarget = null;
    if (p.keeper) {
      this.keeperHold[p.team] = 0; this.keeperCmd[p.team] = 0;
      // Buildup phase: outlets open up, opponents reorganize (see updateAI).
      this.buildupTeam = p.team; this.buildupUntil = s.time + 1.5;
      this.roles[p.team] = FRESH_ROLES(); this.roles[other(p.team)] = FRESH_ROLES();
    }
  }

  private checkLines() {
    const s = this.state, b = s.ball, prev = this.previousBall;
    const crossedX = Math.abs(b.x) >= L + R, crossedZ = Math.abs(b.z) >= W + R;
    if (!crossedX && !crossedZ) return false;
    const tx = crossedX ? (Math.sign(b.x) * (L + R) - prev.x) / (b.x - prev.x || .001) : Infinity;
    const tz = crossedZ ? (Math.sign(b.z) * (W + R) - prev.z) / (b.z - prev.z || .001) : Infinity;
    if (crossedZ && tz < tx) { this.setRestart('throwin', other(b.lastTouch), clamp(b.x, -L + 2, L - 2), Math.sign(b.z) * (W - .04)); return true; }
    const u = clamp(tx, 0, 1), lineZ = prev.z + (b.z - prev.z) * u, lineY = prev.y + (b.y - prev.y) * u;
    if (Math.abs(lineZ) < FIELD.goalHalfWidth - .1 && lineY < FIELD.goalHeight - .1) {
      const team = (s.attack[0] === Math.sign(b.x) ? 0 : 1) as TeamId;
      this.scorer = team; s.score[team]++; s.phase = 'goal'; s.phaseTime = 0; s.restart = null;
      s.message = 'GOAL!'; s.messageTime = 2.7; b.owner = null; b.x = Math.sign(b.x) * (L + .9); b.vx = b.vy = b.vz = 0;
      this.cancelShot(); this.events.push({ type: 'goal', team }); this.events.push({ type: 'whistle' }); return true;
    }
    const defending = (s.attack[0] === -Math.sign(b.x) ? 0 : 1) as TeamId;
    if (b.lastTouch === defending) this.setRestart('corner', other(defending), Math.sign(b.x) * (L - .08), Math.sign(b.z || 1) * (W - .08));
    else this.setRestart('goalkick', defending, Math.sign(b.x) * (L - 5), clamp(lineZ * .2, -5, 5));
    return true;
  }
  private setRestart(phase: 'throwin' | 'corner' | 'goalkick', team: TeamId, x: number, z: number) {
    const s = this.state, taker = phase === 'goalkick' ? team * 11 : this.nearest(team, { x, z }).id;
    s.phase = phase; s.phaseTime = 0; s.restart = { team, taker, x, z, wait: .45 }; s.message = ''; s.messageTime = 0; this.restartBuf = null;
    this.placeRestart(s.restart); this.events.push({ type: 'restart', team });
  }
  private placeRestart(r: Restart) {
    const s = this.state, a = s.attack[r.team], b = s.ball, p = s.players[r.taker];
    Object.assign(b, { x: r.x, z: r.z, y: R, vx: 0, vy: 0, vz: 0, spin: 0, owner: null, lock: .15, lastTouch: r.team, flight: 'roll' });
    this.receiver = null; this.peerReceiver = null; s.targetPlayer = null; s.peerTarget = null; this.cancelShot();
    for (const q of s.players) { q.vx = q.vz = 0; q.cooldown = 0; }
    p.x = r.x - a * .65; p.z = r.z; p.facingX = a; p.facingZ = 0;
    if (s.phase === 'throwin') { p.z = Math.sign(r.z) * (W + .45); p.facingX = 0; p.facingZ = -Math.sign(r.z); }
    if (s.phase === 'corner') { p.x = r.x - a * .65; p.facingZ = -Math.sign(r.z) * .9; p.facingX = -a * .3; }
    if (s.phase === 'kickoff') {
      for (const q of s.players) if (q.id !== p.id) {
        const qa = s.attack[q.team]; q.x = -qa * Math.max(4, Math.abs(q.homeX)); q.z = q.homeZ;
      }
      const partner = s.players[r.team * 11 + 9]; partner.x = -a * 2.5; partner.z = 4;
    }
    if (s.phase === 'throwin' || s.phase === 'goalkick') {
      const q = this.nearest(r.team, b, p.id); q.x = clamp(r.x + a * 7, -L + 7, L - 7); q.z = s.phase === 'throwin' ? r.z - Math.sign(r.z) * 8 : r.z + 7;
    }
    if (s.phase === 'corner') {
      const attack = this.team(r.team).filter(q => !q.keeper && q.id !== p.id).slice(-5);
      attack.forEach((q, i) => { q.x = a * (L - 7 - (i % 3) * 3); q.z = (i - 2) * 3; });
      this.team(other(r.team)).filter(q => !q.keeper).slice(0, 5).forEach((q, i) => { q.x = a * (L - 5 - (i % 3) * 3); q.z = (i - 2) * 3 + 1; });
    }
    for (const q of this.team(other(r.team))) if (!q.keeper && distance(q, b) < 6) { const d = direction(q.x - b.x || -a, q.z - b.z || 1); q.x = clamp(b.x + d.x * 6, -L + 1, L - 1); q.z = clamp(b.z + d.z * 6, -W + 1, W - 1); }
    this.setControlled(r.team, p.id);
  }
  /**
   * Restarts: ~450ms setup, buffered human input, and a ~4s decision
   * timeout with a deterministic safe default (short outlet). PASS takes
   * it short, SHOOT takes it long. No indefinite stalling, online or solo.
   */
  private takeRestart(dt: number, i: InputFrame, peer: InputFrame = EMPTY_INPUT) {
    const s = this.state, r = s.restart; if (!r) return;
    r.wait -= dt;
    const human = r.team === s.humanTeam || r.team === s.remoteTeam;
    const f = r.team === s.humanTeam ? i : r.team === s.remoteTeam ? peer : EMPTY_INPUT;
    const p = s.players[r.taker], a = s.attack[r.team], phase = s.phase;
    const edge = f.pass || f.shootPressed;
    if (r.wait > 0) {
      // Setup window: buffer the first edge + aim so an early press is not lost.
      if (human && edge && !this.restartBuf) {
        this.restartBuf = { pass: !!f.pass, shoot: !!f.shootPressed, x: f.x, z: f.z };
      }
      return;
    }
    const buf = this.restartBuf; this.restartBuf = null;
    const pass = f.pass || !!buf?.pass, shoot = f.shootPressed || !!buf?.shoot;
    const fx = edge ? f.x : (buf?.x ?? 0), fz = edge ? f.z : (buf?.z ?? 0);
    if (human && !(pass || shoot) && r.wait > -4) return;
    if (!human && r.wait > -.7) return;
    const aim = (Math.hypot(fx, fz) > .1 && human) || (buf && Math.hypot(buf.x, buf.z) > .1)
      ? direction(fx || buf?.x || 0, fz || buf?.z || 0) : direction(a, 0);
    if (phase === 'corner') {
      if (pass && human) {
        const q = this.nearest(r.team, { x: r.x - a * 8, z: r.z - Math.sign(r.z) * 6 }, p.id);
        q.x = r.x - a * 8; q.z = r.z - Math.sign(r.z) * 6; this.pass(p, q, false);
      } else this.cross(p);
    } else if (phase === 'throwin') {
      const inward = -Math.sign(r.z);
      const d = direction(human && (fx || fz) ? fx : a * .5, inward * Math.max(.55, Math.abs(human ? fz : 1)));
      const point = { x: clamp(r.x + d.x * 9, -L + 4, L - 4), z: r.z + d.z * 9 };
      const q = this.nearest(r.team, point, p.id);
      this.kick(p, d, 13.5, 4.5, 'pass');
      this.receiver = q.id; this.receivePoint = point; this.receiveUntil = s.time + 2;
      this.setReceiver(r.team, q.id, point, s.time + 2);
      this.setControlled(r.team, q.id);
    } else if (phase === 'goalkick' && shoot && human) {
      this.kick(p, direction(a, aim.z * .6), 29, 7, 'cross');
      this.setControlled(r.team, this.nearest(r.team, { x: r.x + a * 24, z: 0 }).id);
    } else this.pass(p, this.bestTarget(p, phase === 'kickoff' && !(human && (fx || fz)) ? direction(-a * .3, 1) : aim, false), false);
    p.x = clamp(p.x, -L + .6, L - .6); p.z = clamp(p.z, -W + .6, W - .6);
    s.phase = 'playing'; s.restart = null; s.message = ''; s.messageTime = 0;
    const ctrl = this.getControlled(r.team);
    if (ctrl >= 0 && s.players[ctrl].keeper) this.setControlled(r.team, this.nearest(r.team, s.ball).id);
  }
  private kickoff(t: TeamId) {
    const s = this.state; this.resetPositions(); s.phase = 'kickoff'; s.phaseTime = 0;
    s.restart = { team: t, taker: t * 11 + 10, x: 0, z: 0, wait: .45 }; s.message = ''; s.messageTime = 0; this.restartBuf = null;
    this.placeRestart(s.restart);
  }
  private resetPositions() {
    const s = this.state;
    for (const p of s.players) { p.x = p.homeX; p.z = p.homeZ; p.vx = p.vz = 0; p.facingX = s.attack[p.team]; p.facingZ = 0; p.action = 'idle'; p.actionTime = 0; p.cooldown = 0; p.think = .7; p.stamina = 1; p.touchIn = 0; }
    this.keeperHold = [0, 0]; this.keeperReact = [0, 0]; this.keeperCmd = [0, 0]; this.keeperDive = [null, null];
    this.roles = [FRESH_ROLES(), FRESH_ROLES()]; this.buildupUntil = 0;
    this.slideSrc = Array.from({ length: 22 }, () => null); this.idleTime = 0;
  }
  private endHalf() {
    const s = this.state; this.cancelShot(); s.restart = null; s.ball.vx = s.ball.vy = s.ball.vz = 0;
    s.phase = s.half === 1 ? 'halftime' : 'fulltime'; s.message = s.half === 1 ? 'HALF TIME' : 'FULL TIME'; s.messageTime = 999;
    this.events.push({ type: 'whistle' });
  }
  continueHalf() {
    const s = this.state; if (s.phase !== 'halftime') return;
    s.half = 2; s.elapsed = 0; s.attack = [-1, 1];
    for (const p of s.players) p.homeX *= -1;
    this.kickoff(1);
  }
  private recover(dt: number) {
    const s = this.state, b = s.ball;
    if (!Number.isFinite(b.x + b.y + b.z + b.vx + b.vz) || Math.abs(b.x) > 65 || Math.abs(b.z) > 45) { this.kickoff(other(b.lastTouch)); return; }
    const slow = b.owner === null && length(b.vx, b.vz) < .15;
    this.idleTime = slow ? this.idleTime + dt : 0;
    if (this.idleTime > 5) {
      // A dead loose ball attracts an additional support runner; it never teleports.
      const p = this.nearest(b.lastTouch, b, s.controlled);
      this.receiver = p.id; this.receivePoint = { x: b.x, z: b.z }; this.receiveUntil = s.time + 3; this.idleTime = 0;
    }
    if (this.receiveUntil < s.time) { this.receiver = null; s.targetPlayer = null; }
    if (this.peerReceiveUntil < s.time) { this.peerReceiver = null; s.peerTarget = null; }
  }
}
