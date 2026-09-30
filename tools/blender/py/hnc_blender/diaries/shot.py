"""Shot context: one edit.json shot -> an empty scene ready for its builder."""
import json

import bpy

from ..paths import REPO_ROOT, inside_repo
from ..cine import cast, look
from ..cine.camera import Cam

EPISODES = {
    "ep01": dict(
        edit=REPO_ROOT / "packages" / "reels" / "src" / "diaries" / "ep01" / "edit.json",
        voices=REPO_ROOT / "packages" / "reels" / "public" / "generated" / "diaries" / "ep01" / "vo" / "voices.json",
    ),
}

COLLECTIONS = ("SET", "CAST", "PROPS", "LGT", "CAM", "FX")


def load_edit(episode):
    ep = EPISODES[episode]
    edit = json.loads(inside_repo(ep["edit"]).read_text())
    voices = json.loads(inside_repo(ep["voices"]).read_text()) if ep["voices"].exists() else {}
    return edit, voices


class Shot:
    def __init__(self, scene, episode, shot_id, quality="preview"):
        self.scene = scene
        self.episode = episode
        self.edit, self.voices = load_edit(episode)
        spec = next((s for s in self.edit["shots"] if s["id"] == shot_id), None)
        if spec is None:
            raise KeyError(f"{shot_id} not in the {episode} edit")
        self.spec = spec
        self.id = shot_id
        self.fps = self.edit["fps"]
        self.frames = max(1, round(spec["dur"] * self.fps))
        self.dur = self.frames / self.fps
        self.quality = quality
        self.seed = sum(ord(c) for c in shot_id)
        scene["hnc_generated"] = True
        scene["hnc_shot"] = shot_id
        self.cols = {}
        for name in COLLECTIONS:
            c = bpy.data.collections.new(name)
            c["hnc_generated"] = True
            scene.collection.children.link(c)
            self.cols[name] = c
        self.q = look.setup_render(scene, self.frames, quality, fps=self.fps)
        self.people = {}
        self.cam = None

    # ------------------------------------------------------------ timing
    def line(self, line_id):
        """(start, end) of a dialogue line in shot-local seconds (may lie outside the shot)."""
        for d in self.spec.get("dialogue", []):
            if d["line"] == line_id:
                length = self.voices.get(line_id, {}).get("seconds", 1.0)
                return d["at"], d["at"] + length
        raise KeyError(f"{self.id}: line {line_id} is not placed in this shot")

    def line_or(self, line_id, default):
        try:
            return self.line(line_id)
        except KeyError:
            return default

    def sfx_at(self, cue):
        for s in self.spec.get("sfx", []):
            if s["cue"] == cue:
                return s["at"]
        return None

    # ------------------------------------------------------------ cast / camera
    def person(self, canon_id, look_id="home", seed=None, profile=None):
        p = cast.person(self.scene, self.cols["CAST"], canon_id, look_id, fps=self.fps, frames=self.frames,
                        seed=self.seed + len(self.people) * 7 if seed is None else seed, profile=profile)
        self.people[f"{canon_id}:{look_id}:{len(self.people)}"] = p
        return p

    def camera(self, lens, fstop=None, name="CAM"):
        self.cam = Cam(self.cols["CAM"], name, lens, fstop, self.frames, self.fps, self.seed)
        self.scene.camera = self.cam.obj
        return self.cam

    def finish(self, **kw):
        for p in self.people.values():
            if not getattr(p, "_baked", False):
                p.bake()
                p._baked = True
        if self.cam:
            self.cam.bake()
        look.finish(self.scene, **kw)
        self.scene.frame_set(1)
