import React from 'react';
import { useThree } from '@react-three/fiber';
import {
  HNC_RENDER_PROFILE,
  createHncBallVisual,
  createHncDressing,
  createHncPlayerVisual,
  createHncStadium,
  disposeHncBallVisual,
  disposeHncPlayerVisual,
  hncApplyCrowdState,
  hncApplySectionTint,
  hncUpdateDressingFlags,
} from '@floodlight/hnc-visuals';
import { sampleFootballMoment, type ChoreoActor } from '../../football/adapter/choreography';
import { applyChoreoActor } from '../../football/adapter/pose';
import { countryColors, countryName } from '../../football/data/countries';
import { adForSlot, paintAd } from '../../../../../apps/game/src/render/ads';
import { AD_H, AD_W } from '../../../../../apps/game/src/render/ads';
import * as THREE from 'three';

/**
 * Thin R3F adapter around the canonical HNC stadium + ball + players.
 *
 * The football stage mainly:
 * 1. creates/mounts the canonical HNC stadium (useMemo, disposed on unmount)
 * 2. creates/mounts the canonical HNC ball
 * 3. creates/mounts canonical HNC players
 * 4. applies Reel choreography to their transforms/poses
 * 5. allows Remotion camera control (camera lives in ReelComposition)
 *
 * It MUST NOT own a second implementation of pitch/goals/stands/crowd/ball
 * geometry — those belong to @floodlight/hnc-visuals.
 */
export const FootballScene3D: React.FC<{
  frame: number;
  fps: number;
  moment: string;
  home: string;
  away: string;
  attackingTeam?: 'home' | 'away';
  shotStartFrame: number;
  durationInFrames: number;
  /** Moment-clock override (seconds). Absent = shot-local time (legacy). */
  momentTime?: number;
  momentLength?: number;
}> = ({ frame, fps, moment, home, away, attackingTeam = 'home', shotStartFrame, durationInFrames, momentTime, momentLength }) => {
  const localFrame = frame - shotStartFrame;
  const time = momentTime ?? Math.min(durationInFrames / fps, Math.max(0, localFrame / fps));
  const duration = momentLength ?? durationInFrames / fps;
  const choreo = sampleFootballMoment(moment, time, duration, attackingTeam === 'home');
  // Pose clock: legacy shots animate on shot-local time, clocked moments on
  // moment time (so a slow-motion ramp slows gaits and crowd alike).
  const poseTime = momentTime ?? localFrame / fps;
  const hColors = countryColors(home);
  const aColors = countryColors(away);
  // Which stand half holds home fans; clocked moments may seat them behind
  // the goal they attack so the goal eruption is in frame.
  const homeSection = choreo.crowd?.homeSection ?? 0;

  // Canonical sky + fog live on the SCENE (GameRenderer sets
  // scene.background / scene.fog). JSX `<color attach="background">` inside
  // this <group> attached to the Group instead — a no-op — so the Reel showed
  // the composition's navy fill through a transparent canvas, not the game sky.
  const scene = useThree((s) => s.scene);
  React.useMemo(() => {
    scene.background = new THREE.Color(HNC_RENDER_PROFILE.background);
    scene.fog = new THREE.Fog(HNC_RENDER_PROFILE.fogColor, HNC_RENDER_PROFILE.fogNear, HNC_RENDER_PROFILE.fogFar);
  }, [scene]);

  // Canonical stadium (built once per matchup; never rebuilt per frame).
  const stadium = React.useMemo(() => {
    const paintBoard = (slot: number): THREE.Material => {
      try {
        const ad = adForSlot(slot);
        const c = document.createElement('canvas');
        c.width = AD_W;
        c.height = AD_H;
        paintAd(c.getContext('2d')!, ad, AD_W, AD_H);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        return new THREE.MeshBasicMaterial({ map: tex });
      } catch {
        return new THREE.MeshBasicMaterial({ color: '#101b31' });
      }
    };
    return createHncStadium(paintBoard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(
    () => () => {
      stadium.crowdMeshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
    },
    [stadium],
  );

  // Team section tint (once per matchup) + deterministic crowd choreography.
  const leftColor = homeSection === 0 ? hColors.primary : aColors.primary;
  const rightColor = homeSection === 0 ? aColors.primary : hColors.primary;
  React.useMemo(() => {
    hncApplySectionTint(stadium.crowdBase, stadium.crowdMeshes, leftColor, rightColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadium, leftColor, rightColor]);
  React.useMemo(() => {
    if (choreo.crowd) {
      hncApplyCrowdState(stadium.crowdBase, {
        mood: choreo.crowd.mood,
        intensity: choreo.crowd.intensity,
        time,
        seed: 42,
        scoringTeam: choreo.crowd.mood === 'goal' ? homeSection : undefined,
        moodTime: choreo.crowd.moodTime,
      });
      return;
    }
    const phase = choreo.phase;
    const intensity = choreo.crowdIntensity;
    const t = time;
    if (phase === 'goal') {
      hncApplyCrowdState(stadium.crowdBase, {
        mood: 'goal',
        intensity,
        time: t,
        seed: 42,
        scoringTeam: 0,
        moodTime: t,
      });
    } else if (intensity > 0.55) {
      hncApplyCrowdState(stadium.crowdBase, {
        mood: 'wave',
        intensity,
        time: t,
        seed: 42,
        moodTime: t,
      });
    } else {
      hncApplyCrowdState(stadium.crowdBase, {
        mood: 'idle',
        intensity: 0.18,
        time: t,
        seed: 42,
        moodTime: t,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadium, choreo.phase, choreo.crowdIntensity, choreo.crowd?.mood, choreo.crowd?.moodTime, time]);

  // Canonical dressing (section banners + flags), built once per matchup.
  // Banners follow the section tint so each flag sits over its own fans.
  const dressing = React.useMemo(() => {
    const homeSide = { name: countryName(home), color: hColors.primary };
    const awaySide = { name: countryName(away), color: aColors.primary };
    const d = homeSection === 0 ? createHncDressing(homeSide, awaySide) : createHncDressing(awaySide, homeSide);
    stadium.group.add(d.group);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadium, home, away, homeSection]);
  React.useMemo(() => {
    hncUpdateDressingFlags(dressing.flags, time, choreo.crowdIntensity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dressing, time, choreo.crowdIntensity]);

  // Game goal-net pulse (renderer.ts: net.position.x = sign*sin(min(1,phaseTime)*PI)*.22).
  React.useMemo(() => {
    for (const g of stadium.goalNets) {
      const side = Math.sign(g.userData.side as number);
      const net = g.getObjectByName('net');
      if (!net) continue;
      const pulse = choreo.net && choreo.net.side === side ? Math.sin(Math.min(1, choreo.net.phaseTime) * Math.PI) * 0.22 : 0;
      net.position.x = side * pulse;
    }
  }, [stadium, choreo.net?.side, choreo.net?.phaseTime]);

  // Canonical ball (one instance, repositioned per frame).
  const ball = React.useMemo(() => createHncBallVisual(), []);
  React.useEffect(() => () => disposeHncBallVisual(ball), [ball]);
  React.useMemo(() => {
    ball.root.position.set(choreo.ball.x, Math.max(0.25, choreo.ball.y), choreo.ball.z);
    if (momentTime !== undefined) {
      // Game roll (rotation.x += vz*dt*2, rotation.z -= vx*dt*2) integrated
      // in closed form so it stays a pure function of position.
      ball.root.rotation.set(choreo.ball.z * 2, 0, -choreo.ball.x * 2);
    }
    ball.shadow.position.set(choreo.ball.x, 0.015, choreo.ball.z);
    ball.shadow.scale.setScalar(1 + Math.min(1, choreo.ball.y) * 0.45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ball, choreo.ball.x, choreo.ball.y, choreo.ball.z, momentTime]);

  // Canonical players (one visual per choreo actor, stable for the moment).
  const identities = choreo.actors.map((a: ChoreoActor, i: number) => a.number ?? (i % 11) + 1).join(',');
  const players = React.useMemo(() => {
    const visuals = choreo.actors.map(
      (a: ChoreoActor, i: number) => {
        const country = a.team === 'home' || a.team === 'keeper-home' ? home : away;
        const cc = countryColors(country);
        const keeper = a.team.startsWith('keeper');
        const shirt = a.number ?? (i % 11) + 1;
        return createHncPlayerVisual({
          id: shirt,
          number: shirt,
          primary: cc.primary,
          secondary: cc.secondary,
          keeper,
        });
      },
    );
    return visuals;
    // Stable per moment+matchup; choreography length never changes mid-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, moment, identities]);
  React.useEffect(() => () => players.forEach(disposeHncPlayerVisual), [players]);

  // Apply choreography transforms + HNC poses (deterministic from frame).
  React.useMemo(() => {
    players.forEach((v, i) => {
      const a = choreo.actors[i];
      if (a) applyChoreoActor(v, a, poseTime);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, poseTime, choreo.actors]);

  return (
    <group>
      <primitive object={stadium.group} />
      <primitive object={ball.root} />
      <primitive object={ball.shadow} />
      {players.map((v, i) => (
        <group key={i}>
          <primitive object={v.root} />
          <primitive object={v.shadow} />
        </group>
      ))}
      {choreo.actors.map((a: ChoreoActor, i: number) =>
        a.despair ? (
          <group key={`despair-${i}`} position={[a.x, 2.6, a.z]}>
            <mesh>
              <planeGeometry args={[1.4, 0.5]} />
              <meshBasicMaterial color="#101b31" transparent opacity={0.85} />
            </mesh>
          </group>
        ) : null,
      )}
    </group>
  );
};
