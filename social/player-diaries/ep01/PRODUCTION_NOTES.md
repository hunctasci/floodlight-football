# Production notes — 48 Hours Before Belgium (HNC Player Diaries EP01)

The first real production on the hybrid Blender + Remotion pipeline.
Nothing committed or pushed. Final deliverables in `final/`; QA evidence in `qa/`.

## Order of work (as run)

1. **Preflight** — Blender 5.2.2 LTS, Blender Lab MCP on :9876, Remotion 4.0.523, FFmpeg 9.0.2,
   M4 Max; baseline 720 workspace tests + 8 interchange tests green, 0 tsc errors.
2. **Canonical cast** — child proportions + supporting wardrobes added to `@floodlight/hnc-visuals`;
   16 identities exported; TR #9's verification GLB stays byte-identical (sha256 `10dd3264…`).
3. **Performance rig + acting test** (`qa/acting-test.mp4`) — stand, look, walk, sit, reach, sip,
   side-eye + smile. Rig self-test: 12/12 semantic channels move the body the way they are named.
4. **Supporting cast** — child, partner, older supporter, keeper, TR/BE fans (lineup verified).
5. **Environments** — home (5 zones × 5 times of day), car, bakery, training ground, interview,
   street/bus, tunnel. CC0 set dressing from Poly Haven (`ASSET_PROVENANCE.md`).
6. **Storyboard** — `storyboard.md`, generated from `edit.json` (63 shots).
7. **Animatic v1** (`animatic-v1.mp4`, 81.2 s) — all dialogue, rough camera, basic sound, temp title.
8. **Review** (`animatic-review.md`) — 9 s too long, 5 key beats unreadable → v2: 72.35 s, fixes.
9. **Production passes** — readability, lighting, match-cut redesign, net, inserts, audio sync.
10. **Voices v2** (owner note: "too AI; the women are better than the men") — every line re-voiced
    with Chatterbox in the same fictional timbres; cut re-timed to 71.30 s.
11. **Final renders** — EEVEE, 1080×1920, 60 fps, 96 samples, raytracing, motion blur.
12. **Remotion edit**, **mix**, **master**, **QA**.

## Timing (final)

See the report in the final answer / `storyboard.md` for per-shot times. Scene times:
S01 0.00–3.45 · S02 3.45–8.95 · S03 8.95–14.80 · S04 14.80–20.70 · S05 20.70–26.70 ·
S06 26.70–35.05 · S07 35.05–41.00 · S08 41.00–47.95 · S09 47.95–59.65 · S10 59.65–65.95 ·
S11 65.95–71.30.

## Decisions worth knowing

- **Framing HNC people:** heads are ~0.64 m wide. Human shot-size instincts put lenses inside
  faces (the animatic had five such shots). `camera.frame()` computes distance from a shot size
  calibrated to HNC heads; tight rooms get shorter lenses or POV placements.
- **The car close-up** is shot the way car-mount crews do it: 85 mm from outside the passenger
  window, the passenger seat pulled; streetlights are real moving lamps, plus one timed sweep
  light that crosses the face on the smile.
- **Glass the camera looks through** is thin window glass (transparent + Fresnel reflection),
  not raytraced refraction — EEVEE's screen-space refraction smeared the whole frame.
- **The match cut:** one camera for both door shots; the car door's rear edge slams on a fixed
  screen line and the bus door's leading edge starts on that line and keeps sliding left.
- **Voices:** Kokoro renders a neutral reference clip per fictional character; Chatterbox speaks
  the lines in that timbre with natural delivery (3 seeded takes, ASR-verified). Chatterbox copies
  the reference's habits — a reference that began "Mm." produced hums until it was re-recorded.
  "Türkiye" is voiced "Tur-kee-yeh" (the plain spelling came out as "Turkey-I").
- **Sound design** is original synthesis except three CC0 stadium recordings; the score is one
  motif (D–F♯–A) shared with the HNC end sting, anchored to shot starts.

## Known limitations

See the final report (section K).
