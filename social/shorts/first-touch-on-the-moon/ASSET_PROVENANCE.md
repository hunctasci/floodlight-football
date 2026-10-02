# HNC LUNAR AWAY DAY — asset provenance

## External assets acquired locally

| Asset | Creator / source | URL / identifier | License / permission | Modifications | Use |
|---|---|---|---|---|---|
| Richard Strauss — Also Sprach Zarathustra, Introduction / Sunrise (86.073 s recording) | Kevin MacLeod / Incompetech, via Wikimedia Commons | https://commons.wikimedia.org/wiki/File:Richard_Strauss_-_Also_Sprach_Zarathustra.ogg ; original https://upload.wikimedia.org/wikipedia/commons/f/fc/Richard_Strauss_-_Also_Sprach_Zarathustra.ogg | CC BY 3.0 Unported: https://creativecommons.org/licenses/by/3.0/ | Continuous original-tempo excerpt (43.20 s through the natural 86.073 s ending), constant gain adjusted, 25 ms entry fade; natural ending retained | Music build and climax |
| Moon small GLB, LRO colour map | NASA's Goddard Space Flight Center; Dan Gallagher, Ernie Wright / LRO | https://svs.gsfc.nasa.gov/14959/ ; https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/moon_small.glb | NASA media reuse guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media/ ; US government scientific model/data, generally not subject to US copyright. Source requests credit to NASA's Goddard Space Flight Center. No endorsement implied. | Rescaled and relit for original orbital shot; no agency marks present | Opening lunar globe only |

The local assets directory contains both source files. The surface terrain,
lander, interior, hardware and ballistic grains are original procedural HNC
production geometry, not downloaded assets. A brief NASA lander search was
completed; an original design was chosen to avoid recognisable agency hardware
and keep the film independently buildable.

## Required music attribution

“Richard Strauss — Also Sprach Zarathustra” recording by Kevin MacLeod
(incompetech.com), licensed under Creative Commons Attribution 3.0:
https://creativecommons.org/licenses/by/3.0/
Source: https://commons.wikimedia.org/wiki/File:Richard_Strauss_-_Also_Sprach_Zarathustra.ogg
Changes: continuous original-tempo excerpt (43.20 s through the natural 86.073 s ending), gain adjusted, entry fade and mixed for HNC Lunar Away Day.

Include this credit and the NASA credit in publication copy. A concise music
credit is also included in the closing film frame. Full copy: `PUBLISH_COPY.md`.

## Internal assets

- HNC-LUNAR-01: dedicated fictional canonical factory fixture, id 21, number 1.
- HNC-LUNAR-02: dedicated fictional canonical factory fixture, id 22, number 2.
- Factory palette lookup uses TR internally, but both colours are overridden,
  national decals are absent, and neither identity is country-specific.
- Canonical HNC ball: `social/blender/generated/hnc/hnc-ball.glb`; unchanged
  embedded canonical ball artwork, physically scaled for shots.
- HNC body/head geometry: `@floodlight/hnc-visuals`, exported through the existing
  interchange factory and parity checked before rigging. Original lunar
  wardrobe accessories, no real agency, club, federation or commercial marks.
- Barlow Condensed / Inter: existing vendored OFL fonts in Reels public assets.
- Voice: no dialogue in final film, per user revision. Earlier two local Qwen takes retained as unused production artifacts. No paid TTS.
- Foley/mechanical: original seeded filtered noise/contact synthesis. No
  external sound libraries, outdoor lunar wind, alarms or continuous tones.

Composition age is not used as permission for a recording. The specific
MacLeod recording's CC BY 3.0 permission is the basis for reuse.

- Outro badge: existing canonical HNC logo from `apps/game/public/icons/hnc-retro-v2.png`; copied locally without modification. Original orbital framing and editorial layout.
