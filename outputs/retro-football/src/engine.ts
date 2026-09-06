import { EMPTY_INPUT, FIELD, TEAMS, type Ball, type GameEvent, type InputFrame, type MatchState, type Player, type Restart, type TeamId, type Vec } from './types';

const L = FIELD.halfLength, W = FIELD.halfWidth, R = FIELD.ballRadius;
export const TUNING = {
  speed: 7.4, sprint: 10.2, acceleration: 22, deceleration: 29, turn: 17,
  pass: 19, through: 25, shot: 28, tackle: 1.9, slideTackle: 2.45, keeperSpeed: 6.8,
  controlRadius: 1.55, receiverRadius: 2.3, keeperReach: 1.7, keeperDiveReach: 2.4,
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const length = (x: number, z: number) => Math.hypot(x, z);
const distance = (a: Vec, b: Vec) => length(a.x - b.x, a.z - b.z);
const direction = (x: number, z: number): Vec => { const d = length(x, z); return d > .001 ? { x: x / d, z: z / d } : { x: 0, z: 0 }; };
const other = (t: TeamId) => (1 - t) as TeamId;

/** Fixed-step arcade simulation. Coordinates are metres; x runs along the pitch. */
export class MatchEngine {
  state: MatchState;
  events: GameEvent[] = [];
  private seed: number;
  private charge = 0;
  private chargingPlayer: number | null = null;
  private receiver: number | null = null;
  private receivePoint: Vec = { x: 0, z: 0 };
  private receiveUntil = 0;
  private possessionGrace = 0;
  private keeperHold = [0, 0];
  private keeperReact = [0, 0];
  private previousBall = { x: 0, z: 0, y: R };
  private scorer: TeamId = 0;
  private idleTime = 0;

  constructor(teamIndex = 0, halfDuration = 180, seed = 1) {
    this.seed = seed >>> 0 || 1;
    const names = ['Hale', 'Costa', 'Miro', 'Benn', 'Rossi', 'Khan', 'Silva', 'Nolan', 'Vega', 'Dane', 'Ortega'];
    const homes = [[-43, 0], [-29, -21], [-30, -7], [-30, 7], [-29, 21], [-9, -20], [-11, -7], [-11, 7], [-9, 20], [13, -7], [13, 7]];
    const players: Player[] = [];
    for (let t = 0; t < 2; t++) for (let i = 0; i < 11; i++) {
      const a = t === 0 ? 1 : -1;
      players.push({ id: t * 11 + i, team: t as TeamId, number: i + 1, name: names[(i + t * 3) % 11], keeper: i === 0,
        x: homes[i][0] * a, z: homes[i][1], homeX: homes[i][0] * a, homeZ: homes[i][1], vx: 0, vz: 0,
        facingX: a, facingZ: 0, stamina: 1, cooldown: 0, action: 'idle', actionTime: 0, think: .5 + this.random(), aiState: 'RETURN_TO_POSITION' });
    }
    this.state = { players, ball: { x: 0, z: 0, y: R, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: 0, lock: 0, lastKicker: null, flight: 'roll' },
      teams: [TEAMS[teamIndex % 4], TEAMS[(teamIndex + 1) % 4]], humanTeam: 0, controlled: 10,
      phase: 'kickoff', phaseTime: 0, half: 1, elapsed: 0, halfDuration, score: [0, 0], attack: [1, -1],
      restart: null, paused: false, message: 'KICK OFF', messageTime: 2, charge: 0, targetPlayer: null, time: 0,
      stats: { shots: [0, 0], saves: [0, 0], passes: [0, 0], tackles: [0, 0], possession: [0, 0] } };
    this.kickoff(0);
  }
  private random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  private team(t: TeamId) { return this.state.players.slice(t * 11, t * 11 + 11); }
  private owner() { const b = this.state.ball; return b.owner === null ? null : this.state.players[b.owner]; }
  private nearest(t: TeamId, at: Vec, exclude = -1) {
    let best = this.state.players[t * 11 + 1], score = Infinity;
    for (const p of this.team(t)) if (!p.keeper && p.id !== exclude) { const d = distance(p, at); if (d < score) { best = p; score = d; } }
    return best;
  }

  update(dt: number, input: InputFrame = EMPTY_INPUT) {
    this.events = [];
    const s = this.state;
    if (s.paused || s.phase === 'halftime' || s.phase === 'fulltime') return;
    dt = clamp(dt, 0, .05); s.time += dt;
    s.messageTime = Math.max(0, s.messageTime - dt);
    this.possessionGrace = Math.max(0, this.possessionGrace - dt);
    for (const p of s.players) {
      p.cooldown = Math.max(0, p.cooldown - dt); p.actionTime = Math.max(0, p.actionTime - dt); p.think -= dt;
      if (p.actionTime <= 0) p.action = length(p.vx, p.vz) > .5 ? 'run' : 'idle';
    }
    if (s.phase === 'goal') { s.phaseTime += dt; if (s.phaseTime > 2.7) this.kickoff(other(this.scorer)); return; }
    if (s.phase !== 'playing') { this.takeRestart(dt, input); return; }
    s.elapsed = Math.min(s.halfDuration, s.elapsed + dt);
    if (s.elapsed >= s.halfDuration) { this.endHalf(); return; }
    const oldOwner = this.owner(); if (oldOwner) s.stats.possession[oldOwner.team] += dt;
    this.selectControl(input);
    this.moveHuman(dt, input);
    this.updateAI(dt, input);
    this.humanActions(dt, input);
    this.separatePlayers();
    this.integrateBall(dt);
    if (this.checkLines()) return;
    this.collectBall(dt);
    this.recover(dt);
  }

  private selectControl(input: InputFrame) {
    const s = this.state, owner = this.owner();
    if (owner?.team === s.humanTeam && !owner.keeper) { s.controlled = owner.id; return; }
    if (s.players[s.controlled].keeper) s.controlled = this.nearest(s.humanTeam, s.ball).id;
    if (input.switchPlayer && owner?.team !== s.humanTeam) {
      const a = s.attack[s.humanTeam]; let best = s.controlled, value = -Infinity;
      for (const p of this.team(s.humanTeam)) if (!p.keeper) {
        const future = { x: s.ball.x + s.ball.vx * .18, z: s.ball.z + s.ball.vz * .18 };
        const v = -distance(p, future) + clamp((s.ball.x - p.x) * a, -8, 8) * .14;
        if (v > value) { value = v; best = p.id; }
      }
      s.controlled = best;
    }
  }
  private steer(p: Player, x: number, z: number, sprint: boolean, dt: number, speedOverride?: number) {
    const d = direction(x, z), moving = length(x, z) > .07;
    const speed = speedOverride ?? (sprint && p.stamina > .08 ? TUNING.sprint : TUNING.speed);
    const gain = 1 - Math.exp(-(moving ? TUNING.acceleration : TUNING.deceleration) * dt);
    p.vx += ((moving ? d.x * speed : 0) - p.vx) * gain;
    p.vz += ((moving ? d.z * speed : 0) - p.vz) * gain;
    if (moving) {
      const current = Math.atan2(p.facingZ, p.facingX), desired = Math.atan2(d.z, d.x);
      const delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
      const angle = current + delta * (1 - Math.exp(-TUNING.turn * dt));
      p.facingX = Math.cos(angle); p.facingZ = Math.sin(angle);
    }
    p.x = clamp(p.x + p.vx * dt, -L + .55, L - .55); p.z = clamp(p.z + p.vz * dt, -W + .5, W - .5);
    p.stamina = clamp(p.stamina + (sprint && moving ? -.11 : .12) * dt, 0, 1);
  }
  private moveHuman(dt: number, i: InputFrame) {
    const s = this.state, p = s.players[s.controlled], b = s.ball;
    if (p.keeper) return;
    const receiverActive = this.receiver === p.id && this.receiveUntil > s.time && b.owner === null;
    if (receiverActive) {
      // FIFA-style assisted run: receiver is magnetised to the ball / meet point.
      const isSpaceBall = b.flight === 'through' || b.flight === 'cross';
      const target = isSpaceBall
        ? this.receivePoint
        : { x: b.x + b.vx * .12, z: b.z + b.vz * .12 };
      const dx = target.x - p.x, dz = target.z - p.z, dist = length(dx, dz);
      const auto = direction(dx, dz);
      if (!isSpaceBall) {
        // Kısa pas ayağa atılır: top kontrol edilene kadar alıcı topa kilitlenir,
        // yön girişi ilk dokunuş yönü olarak sonra uygulanır (FIFA ilk dokunuş).
        // 1.2m içine girince manuel kontrol başlar.
        if (dist > 1.2 || !(i.x || i.z)) {
          this.steer(p, dx, dz, dist > 3, dt, Math.min(TUNING.speed, dist * 4 + .2));
        } else {
          this.steer(p, i.x, i.z, i.sprint, dt);
        }
      } else if (i.x || i.z) {
        // Ara pası/orta boş alana atılır: manuel yön + otomatik koşu harmanlanır.
        const blend = dist < .6 ? 0 : dist < 2.5 ? .55 : .9;
        const ux = i.x + auto.x * blend, uz = i.z + auto.z * blend;
        const n = length(ux, uz) || 1;
        this.steer(p, ux / n, uz / n, i.sprint || dist > 4, dt, dist < 1 ? dist * 5 : undefined);
      } else {
        this.steer(p, dx, dz, dist > 3, dt, Math.min(TUNING.speed, dist * 4 + .2));
      }
      return;
    }
    if (i.x || i.z) {
      // Slight FIFA-like ball attraction: when the loose ball is very close,
      // bend the run toward it so control feels magnetic, not manual-only.
      if (b.owner === null && b.y < 1.4) {
        const dx = b.x - p.x, dz = b.z - p.z, dist = length(dx, dz);
        if (dist < 2.6 && dist > .05) {
          const auto = direction(dx, dz), n = length(i.x, i.z) || 1;
          const ux = i.x / n + auto.x * .35, uz = i.z / n + auto.z * .35;
          const m = length(ux, uz) || 1;
          this.steer(p, ux / m, uz / m, i.sprint, dt);
          return;
        }
      }
      this.steer(p, i.x, i.z, i.sprint, dt);
    } else if (b.owner === null && b.y < 1.2) {
      // Idle controlled player drifts to a nearby loose ball (modern assist).
      const dx = b.x + b.vx * .1 - p.x, dz = b.z + b.vz * .1 - p.z, dist = length(dx, dz);
      if (dist < 6 && dist > .05) {
        this.steer(p, dx, dz, dist > 3, dt, Math.min(TUNING.speed, dist * 4));
        return;
      }
      this.steer(p, 0, 0, false, dt);
    } else this.steer(p, 0, 0, false, dt);
  }
  private updateAI(dt: number, input: InputFrame) {
    const s = this.state, b = s.ball;
    // If a pass/cross/through is in flight for team t, that receiver owns the
    // chase — teammates hold shape instead of crowding the same ball.
    const activeReceiverTeam: (TeamId | null)[] = [null, null];
    if (this.receiver !== null && this.receiveUntil > s.time && b.owner === null) {
      const rp = s.players[this.receiver];
      if (rp) activeReceiverTeam[rp.team] = rp.team;
    }
    for (const t of [0, 1] as TeamId[]) {
      const owner = this.owner(), owns = owner ? owner.team === t : b.lastTouch === t;
      const a = s.attack[t], chaser = this.nearest(t, { x: b.x + b.vx * .16, z: b.z + b.vz * .16 }, !owner && distance(s.players[s.controlled], b) > 3 ? s.controlled : -1);
      const cover = this.nearest(t, b, chaser.id);
      for (const p of this.team(t)) {
        if (p.keeper) { this.goalkeeper(p, dt, input); continue; }
        if (p.id === s.controlled) continue;
        if (b.owner === p.id) { this.aiCarrier(p, dt); continue; }
        const role = p.id % 11;
        let tx = p.homeX + a * (clamp(b.x * a * .45, -13, 17) + (owns ? 6 : -2)), tz = p.homeZ + clamp(b.z * .2, -5, 5);
        p.aiState = owns ? 'SUPPORT' : 'DEFEND';
        if (this.receiver === p.id && this.receiveUntil > s.time && b.owner === null) { tx = this.receivePoint.x; tz = this.receivePoint.z; p.aiState = 'CHASE'; }
        else if (activeReceiverTeam[t] !== null) {
          // Teammate is meeting the pass — stay in support shape, but the
          // closest defender still goalside-marks instead of ball-watching.
          if (!owns && p.id === cover.id && b.x * a < -15) { tx = b.x - a * 4; tz = b.z * .65; p.aiState = 'MARK'; }
        }
        else if (!owner && p.id === chaser.id) { tx = b.x + b.vx * .14; tz = b.z + b.vz * .14; p.aiState = 'CHASE'; }
        else if (!owns && p.id === chaser.id) {
          // Modern pres: uzaktayken goalside kademe, dibindeyken topa direkt bas.
          // (Goalside bekleyip topa arkasını dönme kilitlenmesi olmasın.)
          // İstisna: rakip kaleci topu elinde tutuyorsa dibine girme, mesafede bekle.
          const keeperHolds = owner && owner.keeper && owner.team !== t;
          if (keeperHolds) {
            const dx = p.x - b.x, dz = p.z - b.z, d = length(dx, dz) || 1;
            tx = b.x + dx / d * 2.3; tz = b.z + dz / d * 2.3;
          }
          else if (distance(p, b) < 3) { tx = b.x + b.vx * .08; tz = b.z + b.vz * .08; }
          else { tx = b.x - a * .45; tz = b.z; }
          p.aiState = 'CHASE';
        }
        else if (!owns && p.id === cover.id && b.x * a < -15) { tx = b.x - a * 4; tz = b.z * .65; p.aiState = 'MARK'; }
        else if (!owns && role < 5) {
          const attacker = this.team(other(t)).filter(q => !q.keeper && Math.abs(q.z - p.homeZ) < 8 && q.x * a < 7).sort((u, v) => u.x * a - v.x * a)[0];
          if (attacker) { tx = Math.min(tx * a, attacker.x * a - 2) * a; tz = p.homeZ * .35 + attacker.z * .65; p.aiState = 'MARK'; }
        }
        if (owns && role >= 9 && p.aiState === 'SUPPORT') { tx = a * clamp(Math.max(tx * a, b.x * a + 10), -5, L - 7); }
        tx = clamp(tx, -L + 4, L - 4); tz = clamp(tz, -W + 3, W - 3);
        const d = distance(p, { x: tx, z: tz });
        this.steer(p, tx - p.x, tz - p.z, p.aiState === 'CHASE', dt, d < 1 ? d * 5 : undefined);
        const carrier = this.owner();
        // Keepers handling the ball with their hands can never be tackled.
        if (carrier && !carrier.keeper && carrier.team !== t && distance(p, carrier) < 1.65 && p.cooldown === 0 && this.possessionGrace === 0 && this.random() < dt * 2.1) this.tackle(p);
      }
    }
  }
  private aiCarrier(p: Player, dt: number) {
    const s = this.state, a = s.attack[p.team], goalDistance = distance(p, { x: a * L, z: 0 });
    const near = this.team(other(p.team)).filter(q => !q.keeper).sort((u, v) => distance(u, p) - distance(v, p))[0];
    const pressure = distance(near, p);
    p.aiState = 'ATTACK';
    if (p.think <= 0 && p.cooldown === 0) {
      if (goalDistance < 23 && Math.abs(p.z) < 16 && this.random() < dt * (goalDistance < 14 ? 3.0 : 1.1)) {
        this.shoot(p, direction(a, -p.z * .015), .18 + this.random() * .22); p.think = .9; return;
      }
      if (p.x * a > 17 && Math.abs(p.z) > 16 && this.random() < dt * .65) { this.cross(p); p.think = 1; return; }
      if (this.random() < dt * (pressure < 3.5 ? 1.45 : .14)) {
        const through = this.random() < .23, target = this.bestTarget(p, direction(a, p.z > 0 ? -.2 : .2), through);
        if (target && (target.x - p.x) * a > -10) { this.pass(p, target, through); p.think = 1; return; }
      }
    }
    let dz = -p.z * .026;
    if (pressure < 4 && (near.x - p.x) * a > 0) dz += (p.z > near.z ? 1 : -1) * .65;
    this.steer(p, a, dz, false, dt);
  }
  private goalkeeper(p: Player, dt: number, input: InputFrame = EMPTY_INPUT) {
    const s = this.state, b = s.ball, a = s.attack[p.team], ownGoal = -a * L;
    if (b.owner === p.id) {
      this.keeperHold[p.team] += dt; p.vx = p.vz = 0; p.aiState = 'DISTRIBUTE';
      // Koruma balonu: top eldivendeyken rakip kalecinin dibine giremez.
      for (const q of this.team(other(p.team))) if (!q.keeper) {
        const dx = q.x - p.x, dz = q.z - p.z, d = length(dx, dz);
        if (d < 2.0) { const n = d > .001 ? d : 1; q.x = p.x + dx / n * 2.0; q.z = p.z + dz / n * 2.0; }
      }
      const human = p.team === s.humanTeam;
      const aim = human && length(input.x, input.z) > .1 ? direction(input.x, input.z) : direction(a, 0);
      let pressure = Infinity;
      for (const q of this.team(other(p.team))) if (!q.keeper) pressure = Math.min(pressure, distance(q, p));
      if (human) {
        // Nişanlı asistli dağıtım: oklarla yöne nişan al, S kısa, W kontra,
        // D/A uzun. Beklersen kısa pasa otomatik bırakır.
        if (input.pass) { this.pass(p, this.bestTarget(p, aim, false), false); this.keeperHold[p.team] = 0; return; }
        if (input.through) { this.pass(p, this.bestTarget(p, aim, true), true); this.keeperHold[p.team] = 0; return; }
        if (input.cross || input.shootPressed) { this.keeperKick(p, aim); this.keeperHold[p.team] = 0; return; }
        if (this.keeperHold[p.team] > 2.5) {
          this.pass(p, this.bestTarget(p, aim, false), false); this.keeperHold[p.team] = 0;
        }
        return;
      }
      const hurried = pressure < 6;
      if (this.keeperHold[p.team] > (hurried ? .28 : .6)) {
        const target = this.bestTarget(p, { x: a, z: 0 }, false);
        if (!hurried && target) this.pass(p, target, false); else this.kick(p, { x: a, z: pressure < 9 ? .3 : .15 }, 25, 5, 'pass');
        this.keeperHold[p.team] = 0;
      }
      return;
    }
    this.keeperHold[p.team] = 0;
    this.keeperReact[p.team] = Math.max(0, this.keeperReact[p.team] - dt);
    let tx = ownGoal + a * (2.4 + clamp((L - Math.abs(b.x)) * .035, 0, 1.6));
    let tz = clamp(b.z * .29, -3.6, 3.6), speed = TUNING.keeperSpeed;
    const carrier = this.owner();
    if (carrier && carrier.team !== p.team && !carrier.keeper && Math.abs(b.x - ownGoal) < 10 && Math.abs(b.z) < 9) {
      tx = ownGoal + a * clamp(Math.abs(b.x - ownGoal) * .6, 2, 6); tz = clamp(b.z * .85, -6, 6);
      if (distance(p, b) < 1.9 && this.possessionGrace <= 0 && p.cooldown <= 0) {
        p.action = 'dive'; p.actionTime = .45; p.cooldown = .7;
        if (this.random() < .92) { s.stats.saves[p.team]++; this.events.push({ type: 'save', team: p.team }); this.claim(p); return; }
      }
    }
    const incoming = b.owner === null && b.vx * a < -3 && b.flight === 'shot';
    if (incoming && this.keeperReact[p.team] <= 0) {
      const time = (tx - b.x) / b.vx;
      if (time > -.12 && time < 1.3) {
        tz = clamp(b.z + b.vz * Math.max(0, time), -6.2, 6.2);
        if (time < .36 && Math.abs(tz - p.z) > .55 && p.cooldown === 0) { p.action = 'dive'; p.actionTime = .5; p.cooldown = .65; }
        speed = p.action === 'dive' ? 8.4 : TUNING.keeperSpeed;
      }
    } else if (!this.owner() && b.y < 1.6) {
      const distGoal = Math.abs(b.x - ownGoal);
      const ballSpeed = length(b.vx, b.vz);
      // Modern süpürmeci kaleci: yavaş/yuvarlanan toplara (rakip pası dahil)
      // 10m'den uzakta olsa bile çıkar, eliyle alır.
      const sweep = ballSpeed < 13 && distGoal < 17 && Math.abs(b.z) < 13;
      const close = distGoal < 10 && Math.abs(b.z) < 10;
      if (sweep || close) {
        tx = clamp(b.x, Math.min(ownGoal + a * 1.2, ownGoal + a * 9), Math.max(ownGoal + a * 1.2, ownGoal + a * 9)); tz = clamp(b.z, -8, 8);
        speed = TUNING.keeperSpeed;
      }
    }
    p.aiState = incoming ? 'SAVE' : 'GUARD';
    const d = distance(p, { x: tx, z: tz });
    this.steer(p, tx - p.x, tz - p.z, false, dt, Math.min(speed, d * 6));
  }

  private humanActions(dt: number, i: InputFrame) {
    const s = this.state, p = s.players[s.controlled], owner = this.owner();
    // Kaleci topu elinde tutarken tuşlar kaleciye aittir; sahadaki oyuncu dalmaz.
    if (owner && owner.keeper && owner.team === s.humanTeam) { this.cancelShot(); return; }
    const raw = length(i.x, i.z) > .05 ? direction(i.x, i.z) : direction(p.facingX, p.facingZ);
    if (owner?.id === p.id) {
      if (i.pass) { this.pass(p, this.bestTarget(p, raw, false), false, i.sprint); this.cancelShot(); return; }
      if (i.through) { this.pass(p, this.bestTarget(p, raw, true), true); this.cancelShot(); return; }
      if (i.cross) { this.cross(p, raw); this.cancelShot(); return; }
      if (i.shootPressed) { this.charge = 0; this.chargingPlayer = p.id; }
      if (i.shootHeld && this.chargingPlayer === p.id) this.charge = Math.min(.55, this.charge + dt);
      s.charge = this.charge;
      if ((i.shootReleased && this.chargingPlayer === p.id) || (i.shootPressed && !i.shootHeld) || (this.chargingPlayer === p.id && this.charge >= .55)) {
        this.shoot(p, raw, this.charge); this.cancelShot();
      }
    } else {
      this.cancelShot();
      if (i.shootPressed && !owner && distance(p, s.ball) < 2.4 && s.ball.y < 2.6) {
        this.shoot(p, raw, .15); s.message = s.ball.y > 1.25 ? 'HEADER!' : 'FIRST TIME!'; s.messageTime = .7;
      }
      // Modern ayrım: S = kademeli/standing tackle, D = kayarak/slide müdahale.
      else if (i.pass) this.tackle(p, false);
      else if (i.shootPressed) this.tackle(p, true);
    }
  }
  private cancelShot() { this.charge = 0; this.chargingPlayer = null; this.state.charge = 0; }
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
  private pass(p: Player, q: Player | null, through: boolean, driven = false) {
    if (!q) { this.kick(p, direction(p.facingX, p.facingZ), 18, 0, 'pass'); return; }
    const s = this.state, a = s.attack[p.team], d = distance(p, q);
    let tx = q.x + q.vx * .22, tz = q.z + q.vz * .22;
    if (through) { tx += a * (6.5 + clamp(d * .15, 0, 4)); tz += q.vz * .3; }
    tx = clamp(tx, -L + 3, L - 3); tz = clamp(tz, -W + 2, W - 2);
    // Driven/pinged pas (E+S): sert, düz, kesilmesi zor ama kontrolü zor.
    const speed = driven ? clamp(24 + d * .3, 26, 32) : through ? clamp(23 + d * .15, 25, 29) : clamp(15 + d * .36, 19, 27);
    this.kick(p, direction(tx - s.ball.x, tz - s.ball.z), speed, through ? .65 : .2, through ? 'through' : 'pass');
    this.receiver = q.id; this.receivePoint = { x: tx, z: tz }; this.receiveUntil = s.time + 2.7;
    if (p.team === s.humanTeam) { s.controlled = q.id; s.targetPlayer = q.id; }
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
    if (p.team === s.humanTeam) { s.targetPlayer = target.id; s.controlled = target.id; }
  }
  /** Kaleci uzun topu: nişan yönündeki en uygun arkadaş hedeflenir, top havadan yumuşak iner. */
  private keeperKick(p: Player, aim: Vec) {
    const s = this.state;
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
    if (p.team === s.humanTeam) { s.controlled = rec.id; s.targetPlayer = rec.id; }
  }
  private shoot(p: Player, aim: Vec, charge: number) {
    const s = this.state, a = s.attack[p.team], dx = a * L - s.ball.x;
    const intentZ = Math.abs(aim.z) > .28 ? Math.sign(aim.z) * 2.55 : clamp(-p.z * .12, -1.6, 1.6);
    const inRange = Math.abs(dx) < 34;
    const targetZ = inRange ? intentZ : clamp(p.z + aim.z * Math.abs(dx) * .65, -6, 6);
    const spread = .35 + Math.max(0, Math.abs(dx) - 15) * .05 + (length(p.vx, p.vz) > 8 ? .45 : 0);
    const z = targetZ + (this.random() - .5) * spread * 2;
    const d = direction(dx, z - s.ball.z);
    this.kick(p, d, TUNING.shot + clamp(charge / .55, 0, 1) * 9, 1.5 + charge * 3.0, 'shot');
    this.keeperReact[other(p.team)] = .12 + this.random() * .05;
  }
  private kick(p: Player, d: Vec, speed: number, vy: number, flight: Ball['flight']) {
    const b = this.state.ball;
    b.owner = null; b.lock = .12; b.lastTouch = p.team; b.lastKicker = p.id; b.vx = d.x * speed; b.vz = d.z * speed; b.vy = vy; b.flight = flight;
    p.cooldown = .25; p.action = 'kick'; p.actionTime = .25;
    this.receiver = null; this.state.targetPlayer = null; this.possessionGrace = 0;
    this.events.push({ type: flight === 'shot' ? 'shot' : 'kick', team: p.team, power: speed });
    if (flight === 'shot') this.state.stats.shots[p.team]++;
  }
  private tackle(p: Player, slide = false) {
    if (p.cooldown > 0) return;
    // Kayarak müdahale daha uzun menzilli ama daha çok açık verir.
    const reach = slide ? TUNING.slideTackle : TUNING.tackle;
    p.cooldown = slide ? .8 : .48; p.action = 'tackle'; p.actionTime = slide ? .32 : .25;
    const owner = this.owner(), b = this.state.ball;
    if (!owner || owner.team === p.team || owner.keeper || this.possessionGrace > 0) return;
    const offset = direction(b.x - p.x, b.z - p.z), facing = offset.x * p.facingX + offset.z * p.facingZ;
    if (distance(p, owner) < reach && facing > -.15 && this.random() < (slide ? .8 : .86)) {
      b.owner = null; b.lock = .14; b.lastTouch = p.team; b.lastKicker = owner.id;
      b.vx = p.facingX * (slide ? 7.5 : 5.5); b.vz = p.facingZ * (slide ? 7.5 : 5.5); b.vy = .65; b.flight = 'roll';
      owner.cooldown = .5; this.receiver = null;
      this.state.stats.tackles[p.team]++; this.events.push({ type: 'tackle', team: p.team });
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
    if (owner) {
      // Fizik dışı durum (test/teleport): top sahibinden metrelerce uzaktaysa
      // roketsiz bırak — top olduğu yerde düşer, sahiplenme düşer.
      if (distance(owner, b) > 3.2) { b.owner = null; b.lock = Math.max(b.lock, .08); b.vx *= .2; b.vz *= .2; b.vy = 0; }
      else {
        const speed = length(owner.vx, owner.vz), touch = .8 + speed * .035;
        const tx = owner.x + owner.facingX * touch, tz = owner.z + owner.facingZ * touch;
        const gain = 1 - Math.exp(-12 * dt);
        b.vx += (owner.vx + (tx - b.x) * 9 - b.vx) * gain;
        b.vz += (owner.vz + (tz - b.z) * 9 - b.vz) * gain;
        b.y = R; b.vy = 0;
        if (distance(owner, b) > 2.0 + speed * .02) { b.owner = null; b.lock = .08; }
      }
    } else {
      b.y += b.vy * dt; b.vy -= 18 * dt;
      if (b.y <= R) { b.y = R; b.vy = b.vy < -1.1 ? -b.vy * .32 : 0; }
      const drag = Math.exp(-(b.y > R + .05 ? .075 : .58) * dt);
      b.vx *= drag; b.vz *= drag;
    }
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (!owner) this.goalFrameCollision();
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
    if (b.owner !== null || b.lock > 0) return;
    for (const t of [0, 1] as TeamId[]) {
      const p = s.players[t * 11], a = s.attack[t];
      if (Math.abs(p.x + a * L) > 12 || b.y > (p.action === 'dive' ? 3.0 : 2.6) || (b.x - p.x) * a < -.8) continue;
      const dist = distance(p, b);
      // Yakından gelen şutta bile refleksle elini uzatsın (1m içi her zaman).
      const reach = p.action === 'dive' ? TUNING.keeperDiveReach : TUNING.keeperReach;
      if (dist < reach) {
        const speed = length(b.vx, b.vz), isShot = b.flight === 'shot';
        if (isShot && this.keeperReact[t] > 0 && dist > 1.0) continue;
        if (speed > 13 || isShot) {
          s.stats.saves[t]++; this.events.push({ type: 'save', team: t }); p.action = 'dive'; p.actionTime = .5;
          b.lastTouch = t;
          if (speed < 29 && this.random() < .85) this.claim(p);
          else { b.owner = null; b.vx = a * (4.5 + this.random() * 6); b.vz = (b.z >= p.z ? 1 : -1) * (4 + this.random() * 7); b.vy = 2.0; b.lock = .3; b.flight = 'roll'; }
        } else this.claim(p);
        return;
      }
    }
    if (b.y > 1.05) return;
    // FIFA tarzı mıknatıs: pasın alıcısı topu daha geniş alanda tek dokunuşla alır.
    const receiverLive = this.receiver !== null && this.receiveUntil > s.time;
    let best: Player | null = null, bestScore = Infinity;
    for (const p of s.players) if (!p.keeper && !(p.id === b.lastKicker && p.cooldown > 0)) {
      const limit = receiverLive && p.id === this.receiver ? TUNING.receiverRadius : TUNING.controlRadius;
      const q = distance(p, b);
      if (q >= limit) continue;
      // Alıcıya hafif öncelik: aynı topa iki kişi giderse pasın hedefi alır.
      const score = q * (receiverLive && p.id === this.receiver ? .75 : 1);
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (best) {
      const fastShot = b.flight === 'shot' && length(b.vx, b.vz) > 19;
      if (fastShot && best.team !== b.lastTouch && best.id !== this.receiver) {
        b.vx *= -.28; b.vz += (this.random() - .5) * 7; b.vy = 1.4; b.lock = .18; b.lastTouch = best.team; b.flight = 'roll';
      } else this.claim(best);
    }
  }
  private claim(p: Player) {
    const b = this.state.ball;
    // FIFA ilk dokunuş: top alıcının ayağına yapışır, uzakta kapıp düşürme olmaz.
    b.owner = p.id; b.lastTouch = p.team; b.flight = 'roll';
    b.x = p.x + p.facingX * .8; b.z = p.z + p.facingZ * .8; b.y = R;
    b.vx = p.vx * .3; b.vz = p.vz * .3; b.vy = 0;
    this.possessionGrace = p.keeper ? .6 : .45; p.think = Math.max(p.think, .5); this.receiver = null; this.state.targetPlayer = null;
    if (p.keeper) this.keeperHold[p.team] = 0;
    else if (p.team === this.state.humanTeam) this.state.controlled = p.id;
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
    s.phase = phase; s.phaseTime = 0; s.restart = { team, taker, x, z, wait: .55 }; s.message = ''; s.messageTime = 0;
    this.placeRestart(s.restart); this.events.push({ type: 'restart', team });
  }
  private placeRestart(r: Restart) {
    const s = this.state, a = s.attack[r.team], b = s.ball, p = s.players[r.taker];
    Object.assign(b, { x: r.x, z: r.z, y: R, vx: 0, vy: 0, vz: 0, owner: null, lock: .15, lastTouch: r.team, flight: 'roll' });
    this.receiver = null; s.targetPlayer = null; this.cancelShot();
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
    if (r.team === s.humanTeam) s.controlled = p.id;
  }
  private takeRestart(dt: number, i: InputFrame) {
    const s = this.state, r = s.restart; if (!r) return;
    r.wait -= dt; if (r.wait > 0) return;
    const human = r.team === s.humanTeam, p = s.players[r.taker], a = s.attack[r.team], phase = s.phase;
    if (human && !(i.pass || i.cross || i.through || i.shootPressed)) return;
    if (!human && r.wait > -.7) return;
    const aim = length(i.x, i.z) > .1 && human ? direction(i.x, i.z) : direction(a, 0);
    if (phase === 'corner') {
      if (i.pass && human) {
        const q = this.nearest(r.team, { x: r.x - a * 8, z: r.z - Math.sign(r.z) * 6 }, p.id);
        q.x = r.x - a * 8; q.z = r.z - Math.sign(r.z) * 6; this.pass(p, q, false);
      } else this.cross(p);
    } else if (phase === 'throwin') {
      const inward = -Math.sign(r.z);
      const d = direction(human && (i.x || i.z) ? i.x : a * .5, inward * Math.max(.55, Math.abs(human ? i.z : 1)));
      const point = { x: clamp(r.x + d.x * 9, -L + 4, L - 4), z: r.z + d.z * 9 };
      const q = this.nearest(r.team, point, p.id);
      this.kick(p, d, 13.5, 4.5, 'pass'); this.receiver = q.id; this.receivePoint = point; this.receiveUntil = s.time + 2;
      if (human) { s.controlled = q.id; s.targetPlayer = q.id; }
    } else if (phase === 'goalkick' && (i.shootPressed || i.cross) && human) {
      this.kick(p, direction(a, aim.z * .6), 29, 7, 'cross');
      s.controlled = this.nearest(r.team, { x: r.x + a * 24, z: 0 }).id;
    } else this.pass(p, this.bestTarget(p, phase === 'kickoff' && !(human && (i.x || i.z)) ? direction(-a * .3, 1) : aim, i.through), !!i.through);
    p.x = clamp(p.x, -L + .6, L - .6); p.z = clamp(p.z, -W + .6, W - .6);
    s.phase = 'playing'; s.restart = null; s.message = ''; s.messageTime = 0;
    if (s.players[s.controlled].keeper) s.controlled = this.nearest(s.humanTeam, s.ball).id;
  }
  private kickoff(t: TeamId) {
    const s = this.state; this.resetPositions(); s.phase = 'kickoff'; s.phaseTime = 0;
    s.restart = { team: t, taker: t * 11 + 10, x: 0, z: 0, wait: .6 }; s.message = ''; s.messageTime = 0;
    this.placeRestart(s.restart);
  }
  private resetPositions() {
    const s = this.state;
    for (const p of s.players) { p.x = p.homeX; p.z = p.homeZ; p.vx = p.vz = 0; p.facingX = s.attack[p.team]; p.facingZ = 0; p.action = 'idle'; p.actionTime = 0; p.cooldown = 0; p.think = .7; p.stamina = 1; }
    this.keeperHold = [0, 0]; this.keeperReact = [0, 0]; this.idleTime = 0;
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
  }
}
