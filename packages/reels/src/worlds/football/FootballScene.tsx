import React from 'react';
import {
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
import { footballLight, footballLightLevel, footballMoment, footballRoles, shotChoreo, shotMomentTime } from './football.world';
import { MOMENT_ROLES, type ChoreoActor } from './choreography';
import { countryColors, countryName, isValidCountryCode } from '../../cast/countries';
import { countryTeams } from '../../../../../apps/game/src/city-league/kits';
import type { SceneProps } from '../../render/worlds';
import * as THREE from 'three';
import { FLOOD_HEADS, FootballLighting, paintHncBoard, practicalLevel, Tifo } from './atmosphere';

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
  const time = shotMomentTime(shot, frame, fps);
  const choreo = shotChoreo(shot, frame, fps);
  // Home / away nations: whoever the cast plays on each side, else `set`.
  const sideCountry = (side: 'home' | 'away'): string | undefined =>
    choreo.actors.map((a, i) => (a.team === side || a.team === `keeper-${side}` ? castOf(roles[i])?.country : undefined)).find((c) => c && isValidCountryCode(c));
  const home = sideCountry('home') ?? String(shot.set.home ?? 'TR');
  const away = sideCountry('away') ?? String(shot.set.away ?? (home === 'GR' ? 'TR' : 'GR'));
  // Kits follow the game's own clash rule (away changes shirt when too close).
  const [homeTeam, awayTeam] = countryTeams(home, isValidCountryCode(away) ? away : 'GR');
  const hColors = { primary: homeTeam.color, secondary: homeTeam.secondary };
  const aColors = { primary: awayTeam.color, secondary: awayTeam.secondary };
  const preset = footballLight(shot.set);
  const light = footballLightLevel(timeline, shot, frame);
  const practical = practicalLevel(preset, light.level);
  const empty = shot.set.crowd === 'empty';
  // Which stand half holds home fans; moments may seat them behind the goal
  // they attack so the goal eruption is in frame.
  const homeSection = choreo.crowd.homeSection;

  // Canonical sky + fog live on the SCENE (GameRenderer sets
  // scene.background / scene.fog). JSX `<color attach="background">` inside
  // this <group> attached to the Group instead — a no-op — so the Reel showed
  // the composition's navy fill through a transparent canvas, not the game sky.
  // Sky, fog and the light rig live in atmosphere.tsx (preset + light level).
  // Canonical stadium (built once per matchup; never rebuilt per frame).
  // Boards carry HNC's own marks: campaign content never shows third-party brands.
  const stadium = React.useMemo(() => createHncStadium(paintHncBoard), []);
  // Practicals (floodlight heads, LED boards) dim with the preset / blackout.
  const heads = React.useMemo(() => {
    const out: { mesh: THREE.Mesh; index: number }[] = [];
    stadium.stands.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Math.abs(m.position.y - 20.4) > 0.01) return;
      const index = FLOOD_HEADS.findIndex(([x, , z]) => Math.abs(x - m.position.x) < 0.1 && Math.abs(z - m.position.z) < 0.1);
      if (index >= 0) {
        m.material = (m.material as THREE.Material).clone();
        out.push({ mesh: m, index });
      }
    });
    return out;
  }, [stadium]);
  React.useMemo(() => {
    const lit = preset === 'day' ? [0, 1, 2, 3] : preset === 'night' ? [0, 1, 2, 3] : preset === 'horror' ? [0] : [];
    for (const { mesh, index } of heads) {
      const k = preset === 'day' ? 1 : lit.includes(index) ? Math.max(0.06, light.heads[index] * (preset === 'dawn' ? 0.4 : 1)) : 0.05;
      (mesh.material as THREE.MeshBasicMaterial).color.set('#fffbe8').multiplyScalar(k);
    }
    for (const b of stadium.boards) {
      const m = b.material as THREE.MeshBasicMaterial;
      m.color.setScalar(Math.max(0.04, practical));
    }
  }, [heads, stadium, preset, light.heads.join(','), practical]);
  React.useMemo(() => {
    stadium.crowd.visible = !empty;
  }, [stadium, empty]);
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
    d.group.visible = !empty;
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
    if (choreo.ballSpin) ball.root.rotation.set(choreo.ballSpin.x, choreo.ballSpin.y, choreo.ballSpin.z);
    else ball.root.rotation.set(choreo.ball.z * 2, 0, -choreo.ball.x * 2);
    ball.root.visible = !choreo.ballHidden;
    ball.shadow.visible = !choreo.ballHidden;
    ball.shadow.position.set(choreo.ball.x, 0.015, choreo.ball.z);
    ball.shadow.scale.setScalar(1 + Math.min(1, choreo.ball.y) * 0.45);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ball, choreo.ball.x, choreo.ball.y, choreo.ball.z, choreo.ballSpin?.y, choreo.ballHidden]);

  // Canonical players: one visual per choreo actor, identity from the cast.
  const identity = choreo.actors.map((a: ChoreoActor, i: number) => {
    const member = castOf(roles[i]);
    const keeper = a.team.startsWith('keeper');
    const homeSide = a.team === 'home' || a.team === 'keeper-home';
    const country = member?.country ?? (homeSide ? home : away);
    // Shirts come from the resolved matchup kits (clash rule), identity from the cast.
    const kit = country === home ? hColors : country === away ? aColors : countryColors(country);
    return { country, number: member?.number ?? a.number ?? (i % 11) + 1, keeper, kit };
  });
  const identityKey = identity.map((d) => `${d.country}:${d.number}:${d.keeper}:${d.kit.primary}`).join(',');
  const players = React.useMemo(
    () => identity.map((d) => createHncPlayerVisual({ id: d.number, number: d.number, primary: d.kit.primary, secondary: d.kit.secondary, keeper: d.keeper })),
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
      <FootballLighting preset={preset} level={light.level} stagger={light.heads} />
      <primitive object={stadium.group} />
      {typeof shot.set.tifo === 'string' ? <Tifo code={shot.set.tifo} t={frame / fps} level={preset === 'day' ? 1 : Math.max(0.2, light.level)} /> : null}
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
