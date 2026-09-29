# AGENTS.md — authoring HNC social content

You write a **ContentSpec** (story intent). The engine owns coordinates,
cameras, frame math, CSS, assets, audio files and encoding. Full vocabulary:
`docs/VOCABULARY.md` (generated — `npm run reels:vocab`). Architecture:
`docs/ARCHITECTURE.md`. Concept bank: `docs/CONCEPTS.md`.

## Workflow (do not skip steps)

1. Write a spec: `specs/<id>.json` (no code, no registration) or a TS module in `src/content/`.
2. `npm run reels:validate -- --content specs/<id>.json` — vocabulary (did-you-mean), timing, creative lint, framing + motion QA for every format. Fix every error; read every warning.
3. `npm run reels:qa -- --content <id> --sheet --cuts` — contact sheets of every beat (15/55/92%) and 6 frames around every cut. **Look at them.** Renders successfully ≠ looks good.
4. `npm run reels:render -- --content <id> --scale 0.5` — preview; pull frames from the MP4 and check motion.
5. Fix weak beats, then `npm run reels:render -- --content <id> --format all`.
6. Key art: `npm run reels:still -- --content <id> --key thumb --format square`.

## A spec in one screen

```json
{
  "id": "coffee-standoff", "title": "Coffee Standoff", "fps": 30, "formats": ["reel", "square"],
  "cast": { "hero": { "country": "TR", "number": 9, "name": "Emre" }, "rival": { "country": "GR", "number": 4, "name": "Nikos" } },
  "scenes": [
    { "id": "office", "world": "office", "beats": [
      { "id": "hook", "purpose": "hook", "duration": 1.4, "camera": "over-shoulder:hero>rival push-in",
        "cast": { "hero": { "at": "desk-a", "do": "typing" }, "rival": { "at": "desk-b", "do": "typing" } },
        "text": [{ "say": "POV: your new coworker supports Greece", "style": "pov" }] },
      { "id": "look", "duration": 1.2, "camera": "close:hero",
        "cast": { "hero": { "do": { "do": "side-eye", "lookAt": "desk-b-flag" } } },
        "sound": ["record-scratch", { "cue": "hush", "duration": 1 }] }
    ]},
    { "id": "match", "world": "football", "set": { "moment": "hero-attack", "roles": { "striker": "hero", "rival": "rival" } },
      "enter": { "type": "light-bloom", "from": "ceiling-light", "to": "floodlight" },
      "beats": [{ "id": "faceoff", "duration": 1.3, "clock": { "from": 1.2, "to": 2.5 }, "camera": "faceoff-depth-push" }] }
  ]
}
```

## Rules

- **Cast is identity.** `country` + `number` drive skin, kit, back number and flag in every world. Keep the same person across worlds; change their `looks`, not their identity. Match a football role's choreographed number (validator warns).
- **Camera = intent.** `lens:subject[>subject] move move`. Never write coordinates or FOVs. Portrait is ~29° wide: stage two people in depth (`over-shoulder`, `two-shot`), not side by side.
- **Staging persists** within a scene: a cast member keeps their mark and current action across beats until told otherwise (loops don't restart on a cut). Place everyone the first time they appear (`at`).
- **Time with the grammar**, never frame math: `0.4`, `'60%'`, `'end-0.2'`, `'3f'`, `'faceoff.end-3f'`, `'moment:contact'`.
- **Football beats carry clocks** (moment seconds). Unset clocks chain. Keep screen time ≈ clock time unless you mean a speed ramp — QA flags sprints faster than a human.
- **Transitions connect ideas**: `light-bloom` (light → light), `zoom-through` (into a screen / notification), `whip-pan`, `wipe`, `match-cut`, `cloud-puff`, `glitch`, `flash`, `dip`. Avoid `dip` as a default.
- **Sound is semantic**: cue ids only. World ambience beds are automatic; `hush` makes a comedic silence.
- **Brand arrives at the payoff**, not before it: end on `brand-reveal` in the `title` world.
- Determinism: never `Math.random`, `Date.now`, or accumulated state. Variation comes from `seed`.

## Adding capability

- **World**: `src/worlds/<id>/<id>.world.ts` (marks, props, lights, surfaces, lenses, params) + a scene component, registered in `src/worlds/registry.ts` and `src/render/worlds.tsx`. Share layout constants between both halves.
- **Action**: `src/cast/actions.ts` (pure pose function + gaze weights + posture).
- **Look**: `src/cast/looks.ts` → a wardrobe in `@floodlight/hnc-visuals` (`player/wardrobe.ts`). Base body/head never changes.
- **Lens / move**: generic in `src/camera/lenses.ts` / `moves.ts`; world-specific in the world file.
- **Transition / effect / graphic / cue**: its registry + renderer; then `npm run reels:vocab`.
- Never author HNC character, ball or stadium geometry outside `@floodlight/hnc-visuals` (guard test).
