"""Headless entry point: blender -b [--factory-startup] [file.blend] --python hnc_cli.py -- <command>

Commands:
  build                 rebuild verification/hnc-parity.blend + library/hnc-cinematic-base.blend
  inspect               parity-inspect the open file (or a fresh in-memory import) -> parity-report.json
  render [--shots ...]  render verification stills from the open file
         [--engine CYCLES --samples N --percentage P --suffix S] [--turntable]
  plate --track T --out D  build a Reel Factory plate from a pose track and render PNGs
         [--preview] [--frames A-B] [--stills 1,48] [--save-blend]
  acting-test --out D   cinematic-rig QA shot (stand / look / walk / sit / hold a cup)
         [--quality animatic|preview|final] [--stills 1,200] [--frames A-B] [--save-blend]

Normally invoked through `npm run blender:*` (tools/blender/blender.ts).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bpy  # noqa: E402

from hnc_blender import inspect_parity, plates, render, scene as hnc_scene  # noqa: E402
from hnc_blender.paths import LIBRARY_BLEND, PARITY_BLEND, REPO_ROOT, inside_repo, rel  # noqa: E402


def _fresh_scene(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = name
    return sc


def _save(path):
    out = inside_repo(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out), check_existing=False, compress=False)
    return rel(out)


def cmd_build(_args):
    sc = _fresh_scene("HNC_Parity")
    hnc_scene.build_verification(sc)
    report = inspect_parity.inspect_scene(sc)
    saved = {"parity": _save(PARITY_BLEND)}
    sc = _fresh_scene("HNC_CinematicBase")
    hnc_scene.build_base(sc)
    hnc_scene.apply_shot(sc, hnc_scene.DEFAULT_SHOT)
    saved["library"] = _save(LIBRARY_BLEND)
    print("HNC_RESULT " + json.dumps({"saved": saved, "parity_pass": report["pass"]}))
    return 0 if report["pass"] else 1


def cmd_inspect(_args):
    sc = bpy.context.scene
    if not bpy.data.filepath:  # no file given: import the generated GLBs into an empty scene
        sc = _fresh_scene("HNC_ParityInspect")
        hnc_scene.build_verification(sc)
    report = inspect_parity.inspect_scene(sc)
    out = inspect_parity.write_report(report)
    fails = [f"{a['assetId']}: {c['check']} [{c['node']}]" for a in report["assets"] for c in a["failures"]]
    print("HNC_RESULT " + json.dumps({"report": rel(out), "pass": report["pass"], "failures": fails}))
    return 0 if report["pass"] else 1


def cmd_render(args):
    sc = bpy.context.scene
    if args.engine:
        sc.render.engine = args.engine
    if args.samples:
        if sc.render.engine == "CYCLES":
            sc.cycles.samples = args.samples
        else:
            sc.eevee.taa_render_samples = args.samples
    if args.percentage:
        sc.render.resolution_percentage = args.percentage
    if args.turntable:
        print("HNC_RESULT " + json.dumps({"turntable": render.render_turntable(sc)}))
        return 0
    shots = args.shots or list(hnc_scene.SHOTS)
    results = [render.render_shot(sc, s, suffix=args.suffix) for s in shots]
    print("HNC_RESULT " + json.dumps({"renders": results}))
    return 0


def cmd_plate(args):
    track = plates.load_track(args.track)
    sc = _fresh_scene(f"HNC_Plate_{track['plate']}")
    info = plates.build_plate(sc, track, preview=args.preview)
    if args.hero_samples:
        sc.render.engine = "CYCLES"
        sc.cycles.samples = args.hero_samples
        sc.cycles.device = "GPU"
        sc.cycles.use_denoising = True
        sc.render.use_motion_blur = False
    if args.save_blend:
        info["blend"] = _save(REPO_ROOT / "social" / "blender" / "plates" / f"{track['plate']}.blend")
    frames = tuple(int(x) for x in args.frames.split("-")) if args.frames else None
    stills = [int(x) for x in args.stills.split(",")] if args.stills else None
    info["render"] = plates.render_plate(sc, args.out, frames=frames, stills=stills)
    print("HNC_RESULT " + json.dumps(info))
    return 0


def cmd_acting_test(args):
    from hnc_blender.cine import acting_test
    sc = _fresh_scene("HNC_ActingTest")
    acting_test.build(sc, args.quality)
    if args.save_blend:
        _save(REPO_ROOT / "social" / "blender" / "verification" / "acting-test.blend")
    frames = tuple(int(x) for x in args.frames.split("-")) if args.frames else None
    stills = [int(x) for x in args.stills.split(",")] if args.stills else None
    info = {"render": plates.render_plate(sc, args.out, frames=frames, stills=stills)}
    print("HNC_RESULT " + json.dumps(info))
    return 0


def cmd_diaries_shot(args):
    import importlib
    from hnc_blender.diaries.shot import Shot
    ep = importlib.import_module(f"hnc_blender.diaries.{args.episode}")
    sc = _fresh_scene(f"HNC_{args.episode}_{args.shot}")
    sh = Shot(sc, args.episode, args.shot, args.quality)
    ep.SHOTS[args.shot](sh)
    if args.save_blend:
        _save(REPO_ROOT / "social" / "blender" / "diaries" / args.episode / f"{args.shot}.blend")
    frames = tuple(int(x) for x in args.frames.split("-")) if args.frames else None
    stills = [int(x) for x in args.stills.split(",")] if args.stills else None
    info = {"shot": args.shot, "frames": sh.frames, "render": plates.render_plate(sc, args.out, frames=frames, stills=stills)}
    print("HNC_RESULT " + json.dumps(info))
    return 0


def cmd_rig_selftest(_args):
    from hnc_blender.cine import selftest
    ok = selftest.run(_fresh_scene("HNC_RigSelftest"))
    print("HNC_RESULT " + json.dumps({"pass": ok}))
    return 0 if ok else 1


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(prog="hnc_cli")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("build")
    sub.add_parser("inspect")
    r = sub.add_parser("render")
    r.add_argument("--shots", nargs="*", choices=list(hnc_scene.SHOTS))
    r.add_argument("--engine", choices=["BLENDER_EEVEE", "CYCLES"])
    r.add_argument("--samples", type=int)
    r.add_argument("--percentage", type=int)
    r.add_argument("--suffix", default="")
    r.add_argument("--turntable", action="store_true", help="04-player-turntable.mp4 (120 frames @ 60 fps)")
    pl = sub.add_parser("plate")
    pl.add_argument("--track", required=True)
    pl.add_argument("--out", required=True)
    pl.add_argument("--preview", action="store_true")
    pl.add_argument("--frames")
    pl.add_argument("--stills")
    pl.add_argument("--save-blend", action="store_true")
    pl.add_argument("--hero-samples", type=int, help="Cycles hero still at N samples (Metal) instead of EEVEE")
    at = sub.add_parser("acting-test")
    at.add_argument("--out", required=True)
    at.add_argument("--quality", default="preview", choices=["animatic", "preview", "final"])
    at.add_argument("--frames")
    at.add_argument("--stills")
    at.add_argument("--save-blend", action="store_true")
    sub.add_parser("rig-selftest")
    ds = sub.add_parser("diaries-shot")
    ds.add_argument("--episode", default="ep01")
    ds.add_argument("--shot", required=True)
    ds.add_argument("--quality", default="preview", choices=["animatic", "preview", "final"])
    ds.add_argument("--out", required=True)
    ds.add_argument("--frames")
    ds.add_argument("--stills")
    ds.add_argument("--save-blend", action="store_true")
    # parse_known_args: Cycles reads its own `--cycles-device METAL` from the same argv.
    args, _unknown = parser.parse_known_args(argv)
    code = {"build": cmd_build, "inspect": cmd_inspect, "render": cmd_render, "plate": cmd_plate,
            "acting-test": cmd_acting_test, "rig-selftest": cmd_rig_selftest,
            "diaries-shot": cmd_diaries_shot}[args.command](args)
    sys.exit(code)


main()
