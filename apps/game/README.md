# Retro Football — Saturday Cup

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
| E or Shift | Sprint (hold with S for a driven/pinged pass) |
| S | Short pass / standing tackle (defence: contained pressure) |
| W | Through ball into space |
| A | Cross / lob |
| D | Shoot (hold briefly for power) / sliding tackle when defending |
| Q or Space | Select a useful defender |
| C | Cycle camera: Broadcast → Tactical → Close-up |
| Esc | Pause / resume |
| M | Mute / unmute |
| Enter | Confirm menus / continue at halftime |

You automatically control your ball carrier. The bright ring and triangle identify your controlled footballer. Use the direction arrow beside the scoreboard to check which goal you are attacking. Short passes lock the receiver onto the ball FIFA-style: no need to steer until the first touch; through balls and crosses blend your steering with the runner. Passing uses lane-based selection with no forward bias, so an aimed backward or sideways pass goes backward or sideways; **E+S** hits a driven ping that is hard to intercept but harder to control.

For throw-ins, aim into the pitch with the arrow keys and press **S**. For corners, **A** delivers a cross and **S** takes a short corner. For goal kicks, **S** distributes short and **D** (or **A**) kicks long. The computer takes its own restarts.

Goalkeepers claim balls with their hands, cannot be tackled or crowded while holding (2 m protection bubble, opponents stand off), and sweep loose balls in the box. When your keeper holds the ball, aim with the arrows: **S** throws short to the aimed side, **W** launches a counter through ball, **D**/**A** kick long upfield. Idle the keeper and he releases short on his own.

## Camera & cinematics

Press **C** during a match to cycle three lenses (the active one is shown top-right):

| Camera | View |
| --- | --- |
| Broadcast | Classic sideline TV framing |
| Tactical | High wide shot, almost the whole pitch |
| Close-up | Low tight follow cam |

The lens tracks the ball tightly near the sidelines and keeps play above the bottom HUD strip, on portrait, ultrawide and high-DPI windows alike. Goals trigger a letterboxed low sweep behind the net, kickoff starts with a high stadium sweep, and menus, pause, halftime and full time use a slow showcase orbit. All replays are camera-only: the simulation underneath never changes.

## Play online (P2P lockstep)

From the title screen choose **ONLINE MATCH**. One friend hosts (**CREATE ROOM**), shares the room code (any chat app), the other pastes it (**JOIN ROOM**) and sends the answer back. No account, no server in the match path — browsers talk directly over WebRTC.

- Host is team 1 with your club/length settings; joiner is team 2. Same keyboard/touch controls, same assist rules.
- Pause, half-time (host drives) and state hashes stay in sync; short skew heals automatically.
- If a player drops or quits, their team falls back to AI and the match continues. Rematch = new room (custom leagues arrive next).

## Match rules

Goals, saves, interceptions, rebounds, kickoffs, throw-ins, corners, goal kicks, halftime, second half and full time are included. The final screen offers another match or the main menu. Pausing or moving away from the browser stops the match.

This is deliberately arcade football: no offside, fouls, penalties, substitutions or extra time. Draws stand. Locally one human team plays against the computer (or two humans online); input is keyboard on desktop and touch on mobile. A browser with WebGL support is required. No accounts, downloads of game assets, or central match servers are used during play.

## Mobile & touch

On touch devices the same simulation runs with on-screen controls: a **left virtual stick** (move/aim, analog) and buttons for **PASS, THRU, CROSS, SHOOT** (hold for power), **SPRINT** (hold; SPRINT+PASS = driven pass), **SWITCH**, **CAM** and **PAUSE**. Menus get a ▲▼◀▶ + OK/BACK pad. Play in landscape for the full broadcast view.

## Install as an app (PWA)

The production build is installable: open the hosted address on your phone, then **Add to Home Screen**. It launches fullscreen and works offline (app shell + assets are cached; match traffic is local-first).

## Checks and build

```sh
npm test
npm run build
npm run preview
```

Tests exercise the actual match simulation, including input, restarts, goal collisions and a full default-length match. `dist/` contains the production build for any static web server.

All clubs, players, models, stadium graphics and audio are fictional or original procedural assets. No FIFA, EA, or other proprietary game material is included.
