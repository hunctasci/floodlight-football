"""Cast: import a canonical HNC identity, verify parity, rig it for acting.

Identities are exported by ``npm run blender:export`` (tools/blender/src/
interchange.ts fixtures). Persistent people (TR-PLAYER-09, the family, the
bakery regular…) are documented in social/player-diaries/CAST.md and mapped
to asset ids here; wardrobe = which export of the same person.
"""
from .. import inspect_parity, interchange
from ..paths import GENERATED
from . import rig as cine_rig
from .perform import Performer

# Canon id -> {look: asset id}. Keep in sync with social/player-diaries/CAST.md.
PEOPLE = {
    "TR-PLAYER-09": {
        "kit": "hnc-player-tr-09",
        "home": "hnc-player-tr-09--tee",
        "hoodie": "hnc-player-tr-09--hoodie",
        "interview": "hnc-player-tr-09--interview",
        "travel": "hnc-player-tr-09--travel",
    },
    "TR-FAMILY-CHILD-01": {"home": "hnc-family-tr-child-01--tee", "kit": "hnc-family-tr-child-01--kit"},
    "TR-FAMILY-PARTNER-01": {"home": "hnc-family-tr-partner-01"},
    "TR-SUPPORTER-ELDER-01": {"home": "hnc-supporter-tr-elder-01"},
    "TR-PLAYER-01-GK": {"kit": "hnc-player-tr-01-keeper"},
    "FAN-TR": {"home": "hnc-fan-tr"},
    "FAN-BE": {"home": "hnc-fan-be"},
    "BE-PLAYER-04": {"kit": "hnc-player-be-04", "interview": "hnc-player-be-04--interview"},
    "TR-PLAYER-09-KID": {"home": "hnc-player-tr-09--kid"},
    "BE-PLAYER-04-KID": {"home": "hnc-player-be-04--kid"},
    "TR-FAMILY-FATHER-01": {"home": "hnc-family-tr-father-01"},
    "BE-FAMILY-MUM-01": {"home": "hnc-family-be-mum-01"},
    "TR-PLAYER-10": {"kit": "hnc-player-tr-10"},
    "BE-PLAYER-10": {"kit": "hnc-player-be-10"},
    "IT-PLAYER-08": {"kit": "hnc-player-it-08"},
    # THE GROUP CHAT (shorts): original fictional HR/EN players. Canonical
    # factory builds (white-primary tournament treatments, no official kits).
    "HR-PLAYER-01": {"kit": "hnc-player-hr-01"},
    "EN-PLAYER-01": {"kit": "hnc-player-en-01"},
}

PROFILE = {
    "TR-PLAYER-09": "calm",
    "TR-FAMILY-CHILD-01": "child",
    "TR-PLAYER-09-KID": "child",
    "BE-PLAYER-04-KID": "child",
    "BE-PLAYER-04": "calm",
    "IT-PLAYER-08": "calm",
    "TR-FAMILY-PARTNER-01": "calm",
    "TR-SUPPORTER-ELDER-01": "elder",
    "HR-PLAYER-01": "calm",
    "EN-PLAYER-01": "calm",
}


def _asset(manifest, asset_id):
    for a in manifest["assets"]:
        if a["assetId"] == asset_id:
            return a
    raise RuntimeError(f"{asset_id} not exported — run `npm run blender:export`")


def import_identity(scene, collection, asset_id, manifest=None):
    """Import one canonical GLB and parity-inspect it at rest (raises on mismatch)."""
    manifest = manifest or interchange.load_manifest()
    asset = _asset(manifest, asset_id)
    root = interchange.import_hnc_glb(GENERATED / "hnc" / f"{asset_id}.glb", collection)
    report = inspect_parity.inspect_asset(asset, scene, root)
    if not report["pass"]:
        fails = [f"{c['check']} [{c['node']}]" for c in report["failures"]][:6]
        raise RuntimeError(f"{asset_id}: parity failed on import: {fails}")
    root["hnc_parity_checks"] = report["checks_total"]
    return root, asset


def person(scene, collection, canon_id, look="home", fps=60, frames=120, seed=0, profile=None, manifest=None):
    """Import + verify + rig a persistent person; returns a Performer ready to act."""
    asset_id = PEOPLE[canon_id][look]
    root, asset = import_identity(scene, collection, asset_id, manifest)
    rig = cine_rig.build_rig(root, collection)
    rig.arm["hnc_person"] = canon_id
    rig.arm["hnc_asset"] = asset_id
    rig.arm["hnc_asset_sha256"] = asset["sha256"]
    return Performer(rig, fps=fps, frames=frames, seed=seed, profile=profile or PROFILE.get(canon_id, "calm"))


def prop_identity(scene, collection, asset_id, manifest=None):
    """Canonical non-character assets (ball, goal) with the same import check."""
    root, _asset_rec = import_identity(scene, collection, asset_id, manifest)
    return root
