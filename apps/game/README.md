# Floodlight Football — Saturday Cup

A complete local, single-player football game for **desktop and mobile**. Four fictional clubs, 11 versus 11, original low-poly stadium and synthesized sound.

## Play

From this folder, with Node.js 20.19+ or 22.12+:

```sh
npm install
npm run dev
```

Open the local address printed by Vite. Press **Enter**, choose your club with **←/→**, and press **Enter** again. **S** takes kickoff.

The default match is two three-minute halves. Choose five- or ten-minute halves with **↑/↓** on the team screen. The clock shows football minutes. Play stops at halftime until you press **Enter**. Teams change ends for the second half.

## Keyboard (FIFA PC arrow-keys style)

| Key | Action |
| --- | --- |
| Arrow keys | Move; aim passes, shots, keeper distribution and restarts |
| E or Shift | Sprint |
| S / J | Pass: tap to feet, hold into space; standing tackle on defence |
| W / A | Lofted long ball, cross in the final third; slide tackle on defence |
| D / K | Shoot: hold for power; standing tackle on defence |
| Q or Space | Switch to the nearest available teammate other than the current player |
| C | Cycle camera: Broadcast → Tactical → Close-up |
| Esc | Pause / resume |
| M | Mute / unmute |
| Enter | Confirm menus / continue at halftime |

You automatically control your ball carrier. The bright ring and triangle identify your controlled footballer. Idle defensive selection follows the nearest available outfielder; steering keeps your selection. SWITCH selects the nearest other available outfielder and protects the choice from automatic switching for 750 ms. Keepers and fallen players are excluded. Cooldowns and AI roles never prevent selection.

Passes nominate a receiver, who becomes controlled on first touch. Aim with the stick or arrows; tap PASS to feet or hold it to lead the same receiver into space. Mouse or touch SHOOT drag places the shot; release retains that placement.
For throw-ins, aim into the pitch with the arrow keys and press **S**. For corners, **A** delivers a cross and **S** takes a short corner. For goal kicks, **S** distributes short and **D** (or **A**) kicks long. The computer takes its own restarts.

Goalkeepers claim balls with their hands, cannot be tackled or crowded while holding (2 m protection bubble, opponents stand off), and sweep loose balls in the box. When your keeper holds the ball, aim with the arrows: **S** throws short to the aimed side, **W** launches a lofted long ball, **D**/**A** kick long upfield. Idle the keeper and he releases short on his own.

## Camera & cinematics

Press **C** during a match to cycle three lenses (the active one is shown top-right):

| Camera | View |
| --- | --- |
| Broadcast | Classic sideline TV framing |
| Tactical | High wide shot, almost the whole pitch |
| Close-up | Low tight follow cam |

The lens tracks the ball tightly near the sidelines and keeps play above the bottom HUD strip, on portrait, ultrawide and high-DPI windows alike. Goals trigger a letterboxed low sweep behind the net, kickoff starts with a high stadium sweep, and menus, pause, halftime and full time use a slow showcase orbit. All replays are camera-only: the simulation underneath never changes.

## Play online (P2P lockstep)

From the title screen choose **ONLINE MATCH**. One friend hosts (**PLAY WITH A FRIEND**) and reads out the grouped 6-letter code (`ABC DEF`); the other types it (**JOIN WITH CODE**) and lands directly in the room — then **both press I'M READY** and kick off. No SDP copy-paste, no account, no server URL to configure. In production a tiny Cloudflare control plane only introduces the two browsers (room code + SDP/ICE relay via per-room Durable Objects, same origin as the game); the match itself runs directly over WebRTC. Point LEAGUE → SERVER at a Node backend to use the self-hosted reference instead.

- Host is team 1 with your club/length settings; joiner is team 2. Same keyboard/touch controls, same assist rules.
- Sessions are isolated: rooms live 2h, joins are rate-limited, SDP relays only between room members, and both sides bind the handshake to the room token — a stranger can never land in your match.
- Pause, half-time (host drives) and state hashes stay in sync; short skew heals automatically.
- If a player drops or quits, their team falls back to AI and the match continues. Rematch = new room.
- Server address lives under LEAGUE → SERVER (default `http://127.0.0.1:8080`).

## Match rules

Goals, saves, interceptions, rebounds, kickoffs, throw-ins, corners, goal kicks, halftime, second half and full time are included. The final screen offers another match or the main menu. Pausing or moving away from the browser stops the match.

This is deliberately arcade football: no offside, fouls, penalties, substitutions or extra time. Draws stand. Locally one human team plays against the computer (or two humans online); input is keyboard on desktop and touch on mobile. A browser with WebGL support is required. No accounts, downloads of game assets, or central match servers are used during play.

## Mobile & touch

On touch devices use the **left stick** to move and aim; pushing to its rim sprints. The right cluster contains **PASS**, **LONG**, **SHOOT**, and **SWITCH**. On defence, PASS and SHOOT become **TACKLE**, and LONG becomes **SLIDE**. Hold PASS for a lead pass; hold and drag SHOOT for power and placement. **PAUSE** is at the top left. Menus are directly tappable. Both portrait and landscape layouts respect safe areas, with the radar above the action controls.

For desktop inspection of the mobile layout, the development server supports `?touch` (development only).

## Install as an app (PWA)

The production build is installable: open the hosted address on your phone, then **Add to Home Screen**. It launches fullscreen and works offline (app shell + assets are cached; match traffic is local-first).

## Checks and build

```sh
npm test
npm run build
npm run cf:check   # Worker + Durable Object typecheck
npm run preview
```

Tests exercise the actual match simulation, including input, restarts, goal collisions and a full default-length match. `dist/` contains the production build for any static web server.

All clubs, players, models, stadium graphics and audio are fictional or original procedural assets. No FIFA, EA, or other proprietary game material is included.
