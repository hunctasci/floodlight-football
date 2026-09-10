import React from 'react';
import { countryColors } from '../../football/data/countries';

/**
 * Deterministic football choreography adapter.
 * Reuses HNC concepts (canonical kits, stadium identity, ball/goals/crowd,
 * readable UNDERSTAND->ANTICIPATE->IMPACT->REACT beats) as pure functions of
 * (frame, fps, seed) — no coupling to the live game renderer.
 */

export type FootballMomentType = 'faceoff' | 'attack-goal' | 'crossbar-chaos' | 'keeper-disaster' | 'cross-header-goal';

export interface ChoreoActor {
  team: 'home' | 'away' | 'keeper-home' | 'keeper-away';
  x: number;
  z: number;
  facing: number;
  celebrate?: boolean;
  despair?: boolean;
  dive?: number;
  run?: boolean;
}

export interface ChoreoFrame {
  ball: { x: number; y: number; z: number };
  actors: ChoreoActor[];
  crowdIntensity: number;
  impact: number;
  phase: string;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function seg(t: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (t - a) / Math.max(1e-6, b - a)));
}

export function sampleFootballMoment(
  moment: string,
  time: number,
  duration: number,
  attackingHome: boolean,
): ChoreoFrame {
  const atk: 'home' | 'away' = attackingHome ? 'home' : 'away';
  const def: 'home' | 'away' = attackingHome ? 'away' : 'home';
  switch (moment) {
    case 'faceoff': {
      const k = seg(time, 0, duration);
      const spread = lerp(3.2, 1.1, k);
      return {
        ball: { x: 0, y: 0.25, z: 0 },
        actors: [
          { team: 'home', x: -spread, z: 0, facing: Math.PI / 2, run: k < 0.7 },
          { team: 'away', x: spread, z: 0, facing: -Math.PI / 2, run: k < 0.7 },
        ],
        crowdIntensity: 0.3 + k * 0.3,
        impact: 0,
        phase: k < 0.7 ? 'approach' : 'tension',
      };
    }
    case 'crossbar-chaos': {
      // Comedy: buildup -> long shot -> CLANG -> held rebound -> volley -> goal.
      const tShot = duration * 0.32;
      const tBar = duration * 0.45;
      const tRebound = duration * 0.68;
      const tGoal = duration * 0.82;
      let bx = 0;
      let by = 0.25;
      let phase = 'buildup';
      let impact = 0;
      if (time < tShot) {
        const k = seg(time, 0, tShot);
        bx = lerp(-24, -30, k);
        phase = 'buildup';
      } else if (time < tBar) {
        const k = seg(time, tShot, tBar);
        bx = lerp(-30, 44.5, k * k);
        by = 0.25 + Math.sin(k * Math.PI) * 3.2;
        phase = 'shot';
      } else if (time < tRebound) {
        const k = seg(time, tBar, tRebound);
        bx = 44.5 - k * 6;
        by = 4.5 - k * 1.5 + Math.sin(k * Math.PI) * 1.2;
        phase = k < 0.15 ? 'clang' : 'rebound';
        impact = k < 0.15 ? 1 - k / 0.15 : 0;
      } else if (time < tGoal) {
        const k = seg(time, tRebound, tGoal);
        bx = lerp(38.5, 45.2, k);
        by = lerp(3.0, 1.2, k);
        phase = 'volley';
      } else {
        bx = 45.6;
        by = 0.8;
        phase = 'goal';
      }
      const celebrating = time >= tGoal;
      return {
        ball: { x: bx, y: by, z: lerp(2, 0, seg(time, 0, tGoal)) },
        actors: [
          { team: atk, x: -30, z: 2, facing: Math.PI / 2, run: time < tShot },
          { team: atk, x: lerp(20, 38, seg(time, tBar, tGoal)), z: -2, facing: Math.PI / 2, run: time >= tBar && !celebrating, celebrate: celebrating },
          { team: def, x: 30, z: 3, facing: -Math.PI / 2, run: time < tRebound },
          { team: 'keeper-away', x: 43.5, z: 0, facing: -Math.PI / 2, dive: seg(time, tShot, tBar) * (time < tRebound ? 1 : 0.3), despair: time >= tGoal },
        ],
        crowdIntensity: phase === 'goal' ? 1 : phase === 'clang' ? 0.85 : 0.4 + seg(time, 0, tShot) * 0.3,
        impact,
        phase,
      };
    }
    case 'keeper-disaster': {
      const tShot = duration * 0.3;
      const tSave = duration * 0.42;
      const tClear = duration * 0.62;
      const tGoal = duration * 0.85;
      let bx = -20;
      let by = 0.25;
      let phase = 'buildup';
      if (time < tShot) {
        bx = lerp(-20, -28, seg(time, 0, tShot));
      } else if (time < tSave) {
        const k = seg(time, tShot, tSave);
        bx = lerp(-28, 42, k);
        by = 0.25 + Math.sin(k * Math.PI) * 2.2;
        phase = 'shot';
      } else if (time < tClear) {
        bx = 42 - seg(time, tSave, tClear) * 4;
        by = 1.2;
        phase = time < tSave + 0.6 ? 'save' : 'proud';
      } else if (time < tGoal) {
        const k = seg(time, tClear, tGoal);
        bx = lerp(38, 45.2, k);
        by = lerp(1.5, 1.0, k);
        phase = 'punish';
      } else {
        bx = 45.6;
        by = 0.8;
        phase = 'goal';
      }
      return {
        ball: { x: bx, y: by, z: 0 },
        actors: [
          { team: atk, x: -28, z: 0, facing: Math.PI / 2, run: time < tShot },
          { team: atk, x: lerp(24, 38, seg(time, tClear, tGoal)), z: 1, facing: Math.PI / 2, celebrate: time >= tGoal },
          { team: 'keeper-away', x: 43.5, z: 0, facing: -Math.PI / 2, dive: seg(time, tShot, tSave), despair: time >= tGoal },
        ],
        crowdIntensity: phase === 'goal' ? 1 : phase === 'save' ? 0.9 : 0.5,
        impact: phase === 'save' ? 0.8 : 0,
        phase,
      };
    }
    case 'cross-header-goal': {
      const tCross = duration * 0.55;
      const tGoal = duration * 0.75;
      let bx: number;
      let by: number;
      if (time < tCross) {
        const k = seg(time, 0, tCross);
        bx = lerp(-30, 30, k);
        by = 0.25;
      } else if (time < tGoal) {
        const k = seg(time, tCross, tGoal);
        bx = lerp(30, 42, k);
        by = 0.25 + Math.sin(k * Math.PI) * 4.5;
      } else {
        bx = 45.4;
        by = 1.4;
      }
      return {
        ball: { x: bx, y: by, z: lerp(12, 0, seg(time, 0, tGoal)) },
        actors: [
          { team: atk, x: lerp(-30, 30, seg(time, 0, tCross)), z: 12, facing: 0, run: time < tCross },
          { team: atk, x: 40, z: 0, facing: Math.PI / 2, celebrate: time >= tGoal },
          { team: def, x: 41, z: 1.5, facing: -Math.PI / 2 },
          { team: 'keeper-away', x: 43.5, z: 0, facing: -Math.PI / 2, dive: seg(time, tCross, tGoal) },
        ],
        crowdIntensity: time >= tGoal ? 1 : 0.45 + seg(time, 0, tCross) * 0.25,
        impact: 0,
        phase: time >= tGoal ? 'goal' : time >= tCross ? 'cross' : 'buildup',
      };
    }
    case 'attack-goal':
    default: {
      // Readable default: establish -> pass -> carry -> shot -> goal -> celebration.
      const tPass = duration * 0.22;
      const tCarry = duration * 0.5;
      const tShot = duration * 0.68;
      const tGoal = duration * 0.78;
      let bx = -18;
      let by = 0.25;
      let phase = 'establish';
      if (time < tPass) {
        const k = seg(time, 0, tPass);
        bx = lerp(-18, 8, k);
        phase = 'pass';
      } else if (time < tCarry) {
        const k = seg(time, tPass, tCarry);
        bx = lerp(8, 26, k);
        phase = 'carry';
      } else if (time < tShot) {
        bx = 26 + seg(time, tCarry, tShot) * 2;
        phase = 'settle';
      } else if (time < tGoal) {
        const k = seg(time, tShot, tGoal);
        bx = lerp(28, 45.4, k * k);
        by = 0.25 + Math.sin(Math.min(1, k) * Math.PI) * 1.6;
        phase = 'shot';
      } else {
        bx = 45.6;
        by = 0.8;
        phase = 'goal';
      }
      const celebrating = time >= tGoal;
      return {
        ball: { x: bx, y: by, z: lerp(6, 0, seg(time, 0, tGoal)) },
        actors: [
          { team: atk, x: -18, z: 6, facing: Math.PI / 2, run: time < tPass },
          { team: atk, x: Math.min(bx - 1.2, 27), z: 1, facing: Math.PI / 2, run: time < tShot, celebrate: celebrating },
          { team: def, x: 32, z: -3, facing: -Math.PI / 2, run: time < tShot },
          { team: def, x: 20, z: 5, facing: Math.PI },
          { team: 'keeper-away', x: 43.5, z: 0, facing: -Math.PI / 2, dive: seg(time, tShot, tGoal), despair: celebrating },
        ],
        crowdIntensity: celebrating ? 1 : 0.35 + seg(time, 0, tShot) * 0.35,
        impact: 0,
        phase,
      };
    }
  }
}

export function teamKit(team: 'home' | 'away' | 'keeper-home' | 'keeper-away', home: string, away: string): string {
  if (team === 'keeper-home' || team === 'keeper-away') return '#6b64d9';
  const code = team === 'home' ? home : away;
  return countryColors(code).primary;
}
