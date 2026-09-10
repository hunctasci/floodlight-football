# AGENTS.md — Reel Factory agent interface

Think **semantically**. The factory owns coordinates, cameras, asset paths,
frame math, CSS and FFmpeg. You own story, countries, seed and copy.

## DO

- Use templates: `office-rivalry`, `country-rivalry`.
- Use named actors from `ReelSpec.cast` (`home-worker`, `away-worker`...).
- Use named anchors (`desk-left`, `desk-right`, `coffee-machine`, `faceoff-home`...).
- Use animation ids (`typing`, `celebrate`, `side-eye`, `angry`, `goal-celebration`...).
- Use camera presets (`wide-establish`, `close-reaction`, `dramatic-push`, `football-broadcast`, `celebration-close`...).
- Use transition ids (`cloud-puff`, `cut`, `fade`, `whip-pan`...) and effect ids (`screen-shake`, `confetti`, `speed-lines`...).
- Use football moments (`faceoff`, `attack-goal`, `crossbar-chaos`, `keeper-disaster`, `cross-header-goal`).
- Use audio cues (`typing`, `tension-rise`, `poof`, `whoosh`, `goal-roar`, `brand-sting`...).
- Derive all variation from `rng(seed, '<stable-key>')`.
- Derive all motion from `useCurrentFrame()` / absolute `frame`.
- Validate before rendering: `npm run reels:validate -- --template ...`.

## DO NOT

- Hand-author camera coordinates/FOV in prompts.
- Expose GLB paths to callers (use asset ids like `office-modern-01`).
- Duplicate country data (import from the canonical game source via `src/football/data/countries.ts`).
- Use unseeded randomness (`Math.random`), wall clocks (`Date.now()`), or previous-frame state.
- Bypass the asset registry or the animation/camera/transition registries.
- Create one-off scene architecture when reusable vocabulary solves it.
- Commit binaries without `assets/SOURCES.md` provenance (source/author/license).

## Example: funny office rivalry

```bash
npm run reels:render -- \
  --template office-rivalry \
  --home TR \
  --away GR \
  --seed 42 \
  --football-moment crossbar-chaos \
  --output social/output/tr-gr-office.mp4
```

Custom copy only (never CSS):

```bash
npm run reels:render -- \
  --template office-rivalry \
  --home TR --away GR --seed 42 \
  --headline "WHEN YOUR COWORKER SUPPORTS THE WRONG COUNTRY" \
  --cta "YOUR COUNTRY NEEDS YOU" \
  --output social/output/tr-gr-office.mp4
```

## Example: country rivalry (migration proof)

```bash
npm run reels:render -- \
  --template country-rivalry \
  --home TR --away GR --seed 42 \
  --football-moment attack-goal \
  --output social/output/tr-gr.mp4
```

## Workflow

1. `npm run reels:validate` (fast, no browser).
2. `npm run reels:still` on hook / side-eye / cloud-mid / reveal / payoff / CTA frames.
3. `npm run reels:render` once.
4. `ffprobe` the MP4 (1080x1920, H.264 + AAC).
