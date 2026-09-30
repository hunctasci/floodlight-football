"""HNC cinematic production kit (Player Diaries and future episodes).

Presentation-only layers on top of canonical HNC imports:

  rig      — cinematic performance rig built on an imported canonical character
             (joints derived from the canonical part layout; geometry untouched
             except two rest-neutral edge loops per limb for elbows/knees)
  anim     — sampled channels with easing (the animation maths, no bpy)
  perform  — the performance library: stance, walk, sit, look, hold, cook, kick…
  camera   — lenses, documentary handheld, dolly/push, focus pulls
  look     — materials (PBR + CC0 textures), lighting rigs, worlds
  props    — procedural + CC0 props
  sets     — camera-driven environments (home, car, bakery, training, tunnel…)
  shot     — shot build/render driver (+ cache keys)
"""
