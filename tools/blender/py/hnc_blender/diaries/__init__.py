"""HNC Player Diaries — episode shot builders on top of hnc_blender.cine.

Each episode package (``ep01`` …) registers ``SHOTS = {shot_id: build(ctx)}``.
The cut (packages/reels/src/diaries/<ep>/edit.json) owns durations and
dialogue timing; builders only turn one shot description into a scene.
"""
