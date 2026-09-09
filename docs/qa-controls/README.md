# Engine and mobile controls review

Reviewed 9 September 2026 against the local development build. Changes are local, not deployed.

## Fixes

- **Player switching:** manual input runs before automatic selection. Candidates use actual distance to the ball, with stable ties, excluding keepers and fallen players. Cooldown, marking role and being ahead of the ball no longer penalize selection. SWITCH picks the nearest *other* available player; a 750 ms grace period prevents idle auto-selection immediately undoing the choice. Ball ownership still transfers control to the carrier.
- **Automatic selection:** a fallen nearest player no longer blocks selecting the next available teammate. Steering and committed tackles/slides retain control.
- **Shooting/input:** touch placement survives release until input consumption; mouse placement is also forwarded on release. Releasing one device or alias does not fire while another still holds the action.
- **Touch tracking:** pointer capture tracks each button and joystick independently, ignores additional fingers on an occupied control, and releases on pointer cancellation/lost capture. Held buttons get visible feedback.
- **Kickoff:** LONG now launches a lofted ball rather than silently executing a short pass.
- **Mobile layout:** 76 × 48 SWITCH, separate 56 × 44 PAUSE, safe-area placement, radar above action controls, no permanent bottom instruction strip. Small-screen action buttons remain at least 64 px. Pause instructions explain touch controls.
- **Labels:** restarts show attacking button labels and PASS/LONG prompts. The defensive PASS button now says TACKLE, matching its actual behavior. Rotate guidance is limited to the first eight seconds of ordinary play and suppressed during goals/restarts/messages.
- **Online:** simulation version bumped to 4; manual selection grace is included in snapshots and deterministic hashes. Old simulation clients are rejected by existing version negotiation.

## Captured flow

1. **Lobby — healthy.** Clear primary play action, friend invitation, join code and direct controls help. Local onboarding and matchmaking were exercised; local bot fallback reached a match. Small text remains a readability consideration. [Lobby screenshot](02-lobby.png).
2. **Portrait match — improved.** Before: radar underneath the action cluster, 34 px tall SWITCH, instruction strip at the bottom. After: radar above controls and larger separated targets. Browser SWITCH visibly changed the controlled player. [Before](01-portrait-before.png) · [After](03-portrait-after.png).
3. **Pause/resume — healthy.** PAUSE opens the menu and RESUME returns to play. Final mobile copy uses touch instructions. [Pause screenshot](04-pause.png).
4. **Landscape and narrow phone — improved.** Controls fit at 844 × 390 and 320 × 568. Landscape leaves the central pitch clear. The narrow capture exposed rotate text overlapping a goal; the final code suppresses that nudge during goal/restart messages. [Landscape](05-landscape-after.png) · [Narrow phone](06-small-phone.png).

The initial portrait capture was taken after pointer wiring and PAUSE were added but before the layout changes, so it is layout evidence, not a pristine original-build screenshot. Captures are different live match moments, not pixel comparisons of identical simulation states.

## Validation

- `npm test`: 356 passed, 1 skipped (Redis round-trip requires REDIS_URL); includes 328 game tests.
- Workspace production build and TypeScript checks passed. Final touch-copy/nudge edits also passed the game production build.
- Nine new regressions cover nearest selection while idle/steering, manual selection persistence, fallen candidates, snapshot replay, release placement, mixed-device holds, LONG kickoff, peer throw-in target isolation and peer switching.
- Existing tests cover movement, dribbling/possession, passing, shooting, tackles, keeper behavior, AI shape, collisions/restarts, clocks/halftime/fulltime, full simulated matches and network determinism/session recovery.
- Browser verification used the in-app browser with development-only `?touch` at portrait and landscape sizes. It exercised local lobby → matchmaking → match, SWITCH, PAUSE and RESUME.

## Limits

This is a code/test review plus desktop browser inspection of mobile layouts, not certification of every football situation or physical device. Real iOS/Android multi-touch, thumb comfort, notches, thermal performance and interrupted gestures still need device playtesting. No live two-device multiplayer session or production deployment was performed. The existing build reports a large JavaScript bundle (~714 kB minified); loading performance remains a separate optimization opportunity. No claim is made about viral conversion or retention without player data.
