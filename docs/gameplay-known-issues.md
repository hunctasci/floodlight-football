# Gameplay known issues (reserved for the specialist pass)

Deliberately unfixed in the architecture refactor. Gameplay values and formulas
were frozen — `TUNING` moved verbatim to `game/tuning.ts`, helpers to
`game/math.ts`, no retuning. The next pass (Astra) owns these.

- Goalkeeper distribution vs over-pressing: holding keeper can feel camped;
  protection bubble (4 m) vs press spacing needs a feel pass.
- Shooting frequently converging near the keeper: placement/spread curve
  (`spread`, `intentZ`, charge/run penalties) may funnel shots centrally.
- Scoring too difficult: shot speed/placement vs keeper reach/reaction
  (`keeperReach`, `keeperDiveReach`, `keeperReact`, hold/spill curve) balance.
- Movement/control responsiveness: acceleration/deceleration/turn
  (`acceleration`, `deceleration`, `turn`), analog jog→sprint pace, assist magnet
  strength and first-step burst.
- First-touch/possession feel: `controlRadius`/`receiverRadius` magnet,
  `possessionGrace`, claim teleport vs trap, driven-pass control difficulty.
- Tackle/slide-tackle feel: reach (`tackle`, `slideTackle`), success rates,
  cooldowns (standing 0.48 s vs slide 1.0 s), slide momentum lock, `fallen`
  recovery, victim knock-down distance.
- AI pressing/spacing: chaser/cover assignment, goalside vs direct press,
  `MARK`/`SUPPORT`/`RETREAT` shape, carrier decision rates (shoot/pass/cross),
  keeper sweep (`sweep`/`close`) aggression.
- Mobile unwanted bar/UI issue: reported bottom bar overlapping play on some
  phones (HUD strip vs touch pads vs safe-area; camera `look.z + 2.5` bias and
  `.strip` CSS interplay need a device pass).
- Reported pixel/rendering/performance issues: high-DPI overflow notes in
  `renderer.resize()`, DPR cap 1.5, shadow map size, instanced crowd cost,
  trail puff churn — visual only, no sim impact, but needs a device sweep.

Where to look first: `apps/game/src/engine.ts` (all of the above),
`apps/game/src/game/tuning.ts` (values), `apps/game/tests/` (`match`, `shoot`,
`keeper`, `tackle`, `edgecases`, `determinism` for the frozen contract).
