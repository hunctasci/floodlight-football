"""Shot context: one edit.json shot -> an empty scene ready for its builder."""
import json
import wave

import bpy
import numpy as np

from ..paths import REPO_ROOT, inside_repo
from ..cine import cast, look
from ..cine.camera import Cam

def _episode(ep):
    gen = REPO_ROOT / "packages" / "reels" / "public" / "generated" / "diaries" / ep
    return dict(edit=REPO_ROOT / "packages" / "reels" / "src" / "diaries" / ep / "edit.json", voices=gen / "vo" / "voices.json", vo=gen / "vo")


EPISODES = {ep: _episode(ep) for ep in ("ep01", "rivals", "italy-rematch")}
# Python package names cannot contain the episode's locked hyphenated id.
# Keep the public episode id for edit/cache data while resolving shot modules
# through the repository's underscore package convention.
EPISODES["italy_rematch"] = EPISODES["italy-rematch"]

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
        self._frame_checks = []

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

    def card(self, i=0):
        """(start, end) of the shot's i-th on-screen question card (v4: the interviewer is text), shot-local s."""
        c = self.spec.get("cards", [])[i]
        return c["at"], c["at"] + c["dur"]

    def beats(self, line_id, spacing=0.17, top=0.42):
        """Stressed syllables of the approved take: (shot-local t, strength 0..1) at the loudest
        envelope peaks, at most one per ``spacing`` s. Read from the WAV itself, so re-voicing a
        line re-times the acting (the take length is already part of the plate cache key)."""
        a, _ = self.line(line_id)
        with wave.open(str(inside_repo(EPISODES[self.episode]["vo"] / f"{line_id}.wav"))) as w:
            sr, width, ch = w.getframerate(), w.getsampwidth(), w.getnchannels()
            raw = np.frombuffer(w.readframes(w.getnframes()), np.uint8)
        if width == 3:  # 24-bit PCM -> int32
            b = raw.reshape(-1, 3).astype(np.int32)
            x = (b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)).astype(np.int32)
            x = np.where(x >= 1 << 23, x - (1 << 24), x) / float(1 << 23)
        else:
            x = np.frombuffer(raw.tobytes(), np.int16) / 32768.0
        x = x.reshape(-1, ch).mean(1)
        hop = sr // 100  # 10 ms envelope
        frames = x[: len(x) // hop * hop].reshape(-1, hop)
        env = np.sqrt(np.convolve((frames ** 2).mean(1), np.ones(5) / 5, "same"))
        peak = env.max() or 1.0
        picks = []
        for i in np.argsort(env)[::-1]:
            if env[i] < peak * top:
                break
            t = i / 100.0
            if all(abs(t - u) >= spacing for u, _ in picks):
                picks.append((t, float(env[i] / peak)))
        return sorted((a + t, w_) for t, w_ in picks)

    def talk(self, p, line_id, amount=1.0):
        """``perform.talk`` on this shot's placement of ``line_id``."""
        from ..cine import perform
        a, b = self.line(line_id)
        return perform.talk(p, a + 0.05, b - 0.16, self.beats(line_id), amount)

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

    def keep_in_frame(self, p, times=None, margin=0.06):
        """Fail the build if this person's head leaves the frame at any of `times` (s; default start/mid/end)."""
        self._frame_checks.append((p, times or (0.0, self.dur / 2, max(0.0, self.dur - 1 / self.fps)), margin))

    def finish(self, **kw):
        for p in self.people.values():
            if not getattr(p, "_baked", False):
                p.bake()
                p._baked = True
        if self.cam:
            self.cam.bake()
        look.finish(self.scene, **kw)
        # Framing guard (italy-rematch review: cameras that missed #9 rendered "fine").
        from bpy_extras.object_utils import world_to_camera_view
        for p, times, m in self._frame_checks:
            head = p.rig.parts["head"]
            for t in times:
                self.scene.frame_set(1 + round(t * self.fps))
                co = world_to_camera_view(self.scene, self.scene.camera, head.matrix_world.translation)
                if not (co.z > 0 and m < co.x < 1 - m and m < co.y < 1 - m):
                    raise RuntimeError(f"{self.id}: head of {head.name} out of frame at t={t:.2f}s (x={co.x:.2f}, y={co.y:.2f})")
                # In frame is not enough: a wall or the bedding between lens and face also hides him.
                origin = self.scene.camera.matrix_world.translation.copy()
                target = head.matrix_world.translation
                for _ in range(16):  # step past geometry the shot hides from render (e.g. a removed front wall)
                    ray = target - origin
                    hit, loc, _n, _i, obj, _m = self.scene.ray_cast(bpy.context.evaluated_depsgraph_get(), origin, ray.normalized(), distance=ray.length)
                    if not hit or obj.name.split(".")[0] == head.name.split(".")[0]:
                        break
                    if not obj.hide_render:
                        raise RuntimeError(f"{self.id}: head of {head.name} hidden behind {obj.name} at t={t:.2f}s")
                    origin = loc + ray.normalized() * 1e-3
        self.scene.frame_set(1)
