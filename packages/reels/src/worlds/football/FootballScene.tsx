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
import { applyChoreoActor } from './pose';
import { footballMoment, footballRoles, shotChoreo, shotMomentTime } from './football.world';
import { MOMENT_ROLES, type ChoreoActor } from './choreography';
import { countryColors, countryName } from '../../cast/countries';
import { adForSlot, paintAd } from '../../../../../apps/game/src/render/ads';
import { AD_H, AD_W } from '../../../../../apps/game/src/render/ads';
import type { SceneProps } from '../../render/worlds';
import * as THREE from 'three';
import { HncDaylight } from '../../render/lights';

/**
 * Thin R3F adapter around the canonical HNC stadium + ball + players.
 *
 * 1. creates/mounts the canonical HNC stadium (useMemo, disposed on unmount)
 * 2. creates/mounts the canonical HNC ball
 * 3. creates/mounts canonical HNC players — identity from the cast member
 *    playing each role (country kit, shirt number, skin), else the role's own
 * 4. applies the choreography (shot world clock) to transforms/poses
 *
 * It MUST NOT own a second implementation of pitch/goals/stands/crowd/ball
 * geometry — those belong to @floodlight/hnc-visuals.
 */
export const FootballScene: React.FC<SceneProps> = ({ shot, frame, fps, timeline }) => {
  const moment = footballMoment(shot.set);
  const roles = MOMENT_ROLES[moment] ?? [];
  const cast = footballRoles(shot.set);
  const castOf = (role: string) => (cast[role] ? timeline.cast[cast[role]] : undefined);
  const home = castOf(roles[0])?.country ?? 'TR';
  const away = castOf(roles[1])?.country ?? 'GR';
  const time = shotMomentTime(shot, frame, fps);
  const choreo = shotChoreo(shot, frame, fps);
  const hColors = countryColors(home);
  const aColors = countryColors(away);
  // Which stand half holds home fans; moments may seat them behind the goal
  // they attack so the goal eruption is in frame.
  const homeSection = choreo.crowd.homeSection;

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
    hncApplyCrowdState(stadium.crowdBase, {
      mood: choreo.crowd.mood,
      intensity: choreo.crowd.intensity,
      time,
      seed: 42,
      scoringTeam: choreo.crowd.mood === 'goal' ? homeSection : undefined,
      moodTime: choreo.crowd.moodTime,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadium, choreo.crowd.mood, choreo.crowd.intensity, choreo.crowd.moodTime, time]);

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
    // Game roll (rotation.x += vz*dt*2, rotation.z -= vx*dt*2) integrated
    // in closed form so it stays a pure function of position.
    ball.root.rotation.set(choreo.ball.z * 2, 0, -choreo.ball.x * 2);
    ball.shadow.position.set(choreo.ball.x, 0.015, choreo.ball.z);
    ball.shadow.scale.setScalar(1 + Math.min(1, choreo.ball.y) * 0.45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ball, choreo.ball.x, choreo.ball.y, choreo.ball.z]);

  // Canonical players: one visual per choreo actor, identity from the cast.
  const identity = choreo.actors.map((a: ChoreoActor, i: number) => {
    const member = castOf(roles[i]);
    const keeper = a.team.startsWith('keeper');
    const country = member?.country ?? (a.team === 'home' || a.team === 'keeper-home' ? home : away);
    return { country, number: member?.number ?? a.number ?? (i % 11) + 1, keeper };
  });
  const identityKey = identity.map((d) => `${d.country}:${d.number}:${d.keeper}`).join(',');
  const players = React.useMemo(
    () =>
      identity.map((d) => {
        const cc = countryColors(d.country);
        return createHncPlayerVisual({ id: d.number, number: d.number, primary: cc.primary, secondary: cc.secondary, keeper: d.keeper });
      }),
    // Stable per moment + cast identity; choreography length never changes mid-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moment, identityKey],
  );
  React.useEffect(() => () => players.forEach(disposeHncPlayerVisual), [players]);

  // Apply choreography transforms + HNC poses (deterministic from frame).
  React.useMemo(() => {
    players.forEach((v, i) => {
      const a = choreo.actors[i];
      if (a) applyChoreoActor(v, a, time);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, time, choreo.actors]);

  return (
    <group>
      <HncDaylight />
      <primitive object={stadium.group} />
      <primitive object={ball.root} />
      <primitive object={ball.shadow} />
      {players.map((v, i) => (
        <group key={i}>
          <primitive object={v.root} />
          <primitive object={v.shadow} />
        </group>
      ))}
    </group>
  );
};
