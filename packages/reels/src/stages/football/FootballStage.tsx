import React from 'react';
import {
  applyHncProceduralPose,
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
import { sampleFootballMoment } from '../../football/adapter/choreography';
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
}> = ({ frame, fps, moment, home, away, attackingTeam = 'home', shotStartFrame, durationInFrames }) => {
  const localFrame = frame - shotStartFrame;
  const time = Math.min(durationInFrames / fps, Math.max(0, localFrame / fps));
  const duration = durationInFrames / fps;
  const choreo = sampleFootballMoment(moment, time, duration, attackingTeam === 'home');
  const hColors = countryColors(home);
  const aColors = countryColors(away);

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
  React.useMemo(() => {
    hncApplySectionTint(stadium.crowdBase, stadium.crowdMeshes, hColors.primary, aColors.primary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadium, home, away]);
  React.useMemo(() => {
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
  }, [stadium, choreo.phase, choreo.crowdIntensity, time]);

  // Canonical dressing (section banners + flags), built once per matchup.
  const dressing = React.useMemo(() => {
    const d = createHncDressing(
      { name: countryName(home), color: hColors.primary },
      { name: countryName(away), color: aColors.primary },
    );
    stadium.group.add(d.group);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadium, home, away]);
  React.useMemo(() => {
    hncUpdateDressingFlags(dressing.flags, time, choreo.crowdIntensity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dressing, time, choreo.crowdIntensity]);

  // Canonical ball (one instance, repositioned per frame).
  const ball = React.useMemo(() => createHncBallVisual(), []);
  React.useEffect(() => () => disposeHncBallVisual(ball), [ball]);
  React.useMemo(() => {
    ball.root.position.set(choreo.ball.x, Math.max(0.25, choreo.ball.y), choreo.ball.z);
    ball.shadow.position.set(choreo.ball.x, 0.015, choreo.ball.z);
    ball.shadow.scale.setScalar(1 + Math.min(1, choreo.ball.y) * 0.45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ball, choreo.ball.x, choreo.ball.y, choreo.ball.z]);

  // Canonical players (one visual per choreo actor, stable for the moment).
  const players = React.useMemo(() => {
    const visuals = choreo.actors.map(
      (a: { team: string }, i: number) => {
        const country = a.team === 'home' || a.team === 'keeper-home' ? home : away;
        const cc = countryColors(country);
        const keeper = a.team.startsWith('keeper');
        return createHncPlayerVisual({
          id: (i % 11) + 1,
          number: (i % 11) + 1,
          primary: cc.primary,
          secondary: cc.secondary,
          keeper,
        });
      },
    );
    return visuals;
    // Stable per moment+matchup; choreography length never changes mid-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, moment]);
  React.useEffect(() => () => players.forEach(disposeHncPlayerVisual), [players]);

  // Apply choreography transforms + HNC poses (deterministic from frame).
  React.useMemo(() => {
    players.forEach((v, i) => {
      const a = choreo.actors[i] as
        | { team: string; x: number; z: number; facing: number; celebrate?: boolean; despair?: boolean; run?: boolean; dive?: number }
        | undefined;
      if (!a) return;
      v.root.position.set(a.x, 0, a.z);
      v.root.rotation.set(0, a.facing, 0);
      const localTime = localFrame / fps;
      if (a.celebrate) {
        applyHncProceduralPose(v, 'goal-celebration', localTime);
        v.root.position.y += Math.abs(Math.sin(localTime * 7)) * 0.3;
        v.armL.rotation.z = 1.4;
        v.armR.rotation.z = -1.4;
      } else if (typeof a.dive === 'number' && a.dive > 0.02) {
        // Keeper dive: lateral roll proportional to dive progress.
        v.root.rotation.z = -0.95 * a.dive;
        v.root.position.y = 0.26 * a.dive;
        v.armL.rotation.x = -2.2 * a.dive;
        v.armR.rotation.x = -2.2 * a.dive;
      } else if (a.run) {
        applyHncProceduralPose(v, 'run', localTime);
      } else if (a.despair) {
        applyHncProceduralPose(v, 'facepalm', localTime);
      } else {
        applyHncProceduralPose(v, 'idle', localTime);
      }
      v.shadow.position.set(a.x, 0.015, a.z);
      v.shadow.scale.setScalar(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, localFrame, fps, choreo.actors]);

  return (
    <group>
      <color attach="background" args={['#7fb6e0']} />
      <fog attach="fog" args={['#7fb6e0', 160, 260]} />
      <primitive object={stadium.group} />
      <primitive object={ball.root} />
      <primitive object={ball.shadow} />
      {players.map((v, i) => (
        <group key={i}>
          <primitive object={v.root} />
          <primitive object={v.shadow} />
        </group>
      ))}
      {choreo.actors.map((a: { despair?: boolean }, i: number) =>
        a.despair ? (
          <group key={`despair-${i}`} position={[choreo.actors[i].x, 2.6, choreo.actors[i].z]}>
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
