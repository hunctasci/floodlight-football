# Asset provenance — 48 Hours Before Belgium (HNC Player Diaries EP01)

Everything in the film is one of: **canonical HNC** (generated from the repo),
**original work made for this episode** (procedural in `tools/blender/py/hnc_blender/cine`,
`tools/diaries/py`), or **CC0 / OFL / Apache-2.0 third-party assets** listed below.
No branded products, no real people, no competition/federation marks, no
broadcast footage, no copyrighted music.

## Canonical HNC (single source: `@floodlight/hnc-visuals` → `npm run blender:export`)

| Asset | Source |
|---|---|
| TR #9 (kit, tee, hoodie, interview, travel looks), the child, the partner, the older supporter, TR keeper, TR/BE fans | `createHncPlayerVisual` + `applyHncProportions` + `applyHncWardrobe` (fixtures in `tools/blender/src/interchange.ts`), parity-inspected on every import |
| The ball | `createHncBallVisual` (`hnc-ball.glb`, canonical Canvas texture) |
| The goal + net | `createHncGoals` (`hnc-goal.glb`; the net's LINES rendered as tubes in Blender) |
| The #9 shirt number on the hanging shirt | the exported canonical number texture (`generated/textures/hnc-player-tr-09--HNC_Number_09.png`) |
| Boots insert | the canonical boot meshes copied from the TR #9 export |
| World Table on the phone | the Reel Factory's canonical `WorldTable` graphic (illustrative standings, disclosed on screen) |
| HNC League badge (end card) | `apps/game/public/icons/hnc-retro-v2.png` via the reels brand symlink |

## Poly Haven (CC0 1.0 — https://polyhaven.com/license)

Fetched and md5-verified by `python3 tools/blender/py/fetch_external.py`
(machine record: `social/blender/generated/external/polyhaven/provenance.json`).

| Id | Kind | Asset / authors | License | Used for |
|---|---|---|---|---|
| `cobblestone_street_night` | hdri (2k) | [Cobblestone Street Night](https://polyhaven.com/a/cobblestone_street_night) — Greg Zaal, Jenelle van Heerden | CC0 1.0 | night drive reflections/fill (S01) |
| `stadium_exterior` | hdri (8k) | [Stadium Exterior](https://polyhaven.com/a/stadium_exterior) — Grzegorz Wronkowski | CC0 1.0 | matchday arrival background + light (S10) |
| `suburban_football_field` | hdri (8k) | [Suburban Football Field](https://polyhaven.com/a/suburban_football_field) — Grzegorz Wronkowski | CC0 1.0 | training ground background + light (S06) |
| `sunny_vondelpark` | hdri (4k) | [Sunny Vondelpark](https://polyhaven.com/a/sunny_vondelpark) — Greg Zaal | CC0 1.0 | home window exteriors + interior daylight (all home zones) |
| `urban_street_04` | hdri (4k) | [Urban Street 04](https://polyhaven.com/a/urban_street_04) — Andreas Mischok | CC0 1.0 | day drive, bakery street, house front (S04, S05, S10) |
| `CashRegister_01` | model (1k) | [Cash Register 01](https://polyhaven.com/a/CashRegister_01) — Joe Seabuhr | CC0 1.0 | bakery counter |
| `ClassicNightstand_01` | model (1k) | [Classic Nightstand 01](https://polyhaven.com/a/ClassicNightstand_01) — Kirill Sannikov | CC0 1.0 | bedroom nightstand |
| `WoodenTable_02` | model (2k) | [Wooden Table 02](https://polyhaven.com/a/WoodenTable_02) — Fran Calvente | CC0 1.0 | dining table, bakery window table |
| `concrete_road_barrier` | model (1k) | [Concrete Road Barrier](https://polyhaven.com/a/concrete_road_barrier) — Amal Kumar | CC0 1.0 | matchday arrival barriers |
| `croissant` | model (1k) | [Croissant](https://polyhaven.com/a/croissant) — Greg Zaal, Dario Barresi | CC0 1.0 | bakery display + the regular's table |
| `digital_wrist_watch` | model (1k) | [Digital Wrist Watch](https://polyhaven.com/a/digital_wrist_watch) — Adrian C | CC0 1.0 | matchday watch insert (S10_SH04) |
| `dining_chair_02` | model (1k) | [Dining Chair 02](https://polyhaven.com/a/dining_chair_02) — James Ray Cock | CC0 1.0 | dining + acting-test chairs (scaled to HNC seat height) |
| `hamburger_buns` | model (1k) | [Hamburger Buns](https://polyhaven.com/a/hamburger_buns) — Alexander Shulha | CC0 1.0 | bakery bread shelves |
| `lemon` | model (1k) | [Lemon](https://polyhaven.com/a/lemon) — Kuutti Siitonen | CC0 1.0 | kitchen counter |
| `modern_arm_chair_01` | model (1k) | [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) — Vibrant Nordic | CC0 1.0 | interview chair |
| `modern_coffee_table_01` | model (2k) | [Modern Coffee Table 01](https://polyhaven.com/a/modern_coffee_table_01) — Amin | CC0 1.0 | living room coffee table |
| `potted_plant_01` | model (1k) | [Potted Plant 01](https://polyhaven.com/a/potted_plant_01) — Rico Cilliers | CC0 1.0 | living room, interview |
| `potted_plant_04` | model (1k) | [Potted Plant 04](https://polyhaven.com/a/potted_plant_04) — James Ray Cock | CC0 1.0 | kitchen |
| `sofa_02` | model (2k) | [Sofa 02](https://polyhaven.com/a/sofa_02) — Kirill Sannikov | CC0 1.0 | living room sofa (scaled to HNC ergonomics) |
| `standing_picture_frame_01` | model (1k) | [Standing Picture Frame 01](https://polyhaven.com/a/standing_picture_frame_01) — James Ray Cock | CC0 1.0 | living room (family photo) |
| `wicker_basket_01` | model (1k) | [Wicker Basket 01](https://polyhaven.com/a/wicker_basket_01) — Kuutti Siitonen | CC0 1.0 | bakery side counter |
| `wooden_bowl_01` | model (1k) | [Wooden Bowl 01](https://polyhaven.com/a/wooden_bowl_01) — Oliver Harries | CC0 1.0 | kitchen counter |
| `wooden_cutting_board` | model (1k) | [Wooden Cutting Board](https://polyhaven.com/a/wooden_cutting_board) — Kuutti Siitonen | CC0 1.0 | kitchen (knife insert) |
| `wooden_display_shelves_01` | model (1k) | [Wooden Display Shelves 01](https://polyhaven.com/a/wooden_display_shelves_01) — James Ray Cock | CC0 1.0 | bakery back wall |
| `asphalt_02` | texture (2k) | [Asphalt 02](https://polyhaven.com/a/asphalt_02) — Rob Tuytel | CC0 1.0 | roads, driveway, forecourt |
| `concrete_floor_worn_001` | texture (2k) | [Concrete Floor Worn 001](https://polyhaven.com/a/concrete_floor_worn_001) — Dimitrios Savva, Rico Cilliers | CC0 1.0 | tunnel floor |
| `concrete_wall_008` | texture (2k) | [Concrete Wall 008](https://polyhaven.com/a/concrete_wall_008) — Dario Barresi, Charlotte Baglioni | CC0 1.0 | tunnel + interview walls, facades |
| `fabric_leather_02` | texture (2k) | [Fabric Leather 02](https://polyhaven.com/a/fabric_leather_02) — Rob Tuytel | CC0 1.0 | car seats |
| `floor_tiles_06` | texture (2k) | [Floor Tiles 06](https://polyhaven.com/a/floor_tiles_06) — Rob Tuytel | CC0 1.0 | bakery floor |
| `long_white_tiles` | texture (2k) | [Long White Tiles](https://polyhaven.com/a/long_white_tiles) — Jenelle van Heerden, Sergej Majboroda | CC0 1.0 | kitchen backsplash |
| `marble_01` | texture (2k) | [Marble 01](https://polyhaven.com/a/marble_01) — Rob Tuytel | CC0 1.0 | kitchen + bakery counter tops |
| `oak_veneer_01` | texture (2k) | [Oak Veneer 01](https://polyhaven.com/a/oak_veneer_01) — Jenelle van Heerden | CC0 1.0 | kitchen island, joinery, side tables |
| `painted_plaster_wall` | texture (2k) | [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall) — Amal Kumar | CC0 1.0 | facades, house front |
| `rough_linen` | texture (2k) | [Rough Linen](https://polyhaven.com/a/rough_linen) — colormass, Rico Cilliers | CC0 1.0 | bed linen, pillows |
| `walnut_veneer` | texture (2k) | [Walnut Veneer](https://polyhaven.com/a/walnut_veneer) — Jenelle van Heerden | CC0 1.0 | bed, bakery counter, interview side table, wardrobe |
| `white_plaster_02` | texture (2k) | [White Plaster 02](https://polyhaven.com/a/white_plaster_02) — Rob Tuytel | CC0 1.0 | home walls |
| `wood_floor` | texture (2k) | [Wood Floor](https://polyhaven.com/a/wood_floor) — Dimitrios Savva | CC0 1.0 | home + interview floors |

## Audio

| Asset | Source | License | Used for |
|---|---|---|---|
| Stadium crowd recordings (`goal-roar-01`, `stadium-bed-01/02`) | Freesound (D.jones 528799, BeeProductive 395592) — `packages/social-video/assets/audio/SOURCES.md` | CC0 | title smash, bus arrival crowd, tunnel crowd, white-out roar |
| Every other sound (car, home, kitchen, bakery, football, tunnel foley, the sting) | original synthesis, `tools/diaries/py/sfx.py` | original (this repo) | all foley and beds |
| The score | original synthesis, `tools/diaries/py/score.py` | original (this repo) | music |
| Dialogue voices | **Chatterbox** (Resemble AI, MIT, v0.1.7) speaks every line, conditioned on a per-character reference clip rendered by **Kokoro-82M** (hexgrad, Apache-2.0, via kokoro-onnx MIT) with its stock voices `af_heart`, `am_michael`, `af_bella`, `bf_isabella`, `bm_george`, `am_puck` | MIT / Apache-2.0 model output; fictional synthetic voices — no real person recorded, cloned or imitated. Chatterbox embeds its imperceptible Perth watermark in generated audio (kept, as intended by the model authors) | all dialogue |
| ASR check (not in the film) | faster-whisper `base.en` (MIT) | MIT | intelligibility QA of every take |

## Fonts

| Font | Source | License |
|---|---|---|
| Barlow Condensed (Medium, SemiBold) | github.com/google/fonts `ofl/barlowcondensed` | SIL OFL 1.1 |
| Inter | github.com/google/fonts `ofl/inter` | SIL OFL 1.1 |

## Flag

The small pennant on the car mirror is the plain national flag of Türkiye,
drawn procedurally (`cine/sets/car.py: pennant_tr`). No federation crest.
