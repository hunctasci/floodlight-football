import React from 'react';
import { HNC_RENDER_PROFILE as P } from '@floodlight/hnc-visuals';

/** Canonical HNC daylight (GameRenderer values: hemi 2.35, sun 2.4). */
export const HncDaylight: React.FC = () => (
  <>
    <hemisphereLight args={[P.hemiSky, P.hemiGround, P.hemiIntensity]} />
    <directionalLight
      position={P.sunPosition}
      color={P.sunColor}
      intensity={P.sunIntensity}
      castShadow
      shadow-mapSize={[P.sunShadowMapSize, P.sunShadowMapSize]}
      shadow-camera-left={P.sunShadowLeft}
      shadow-camera-right={P.sunShadowRight}
      shadow-camera-top={P.sunShadowTop}
      shadow-camera-bottom={P.sunShadowBottom}
    />
  </>
);
