"""Fetch the CC0 set-dressing assets used by HNC cinematic productions.

    python3 tools/blender/py/fetch_external.py            # everything in EXTERNAL
    python3 tools/blender/py/fetch_external.py sofa_02    # selected ids

Source: Poly Haven (https://polyhaven.com, CC0 1.0 — no attribution required,
recorded anyway). Files land in social/blender/generated/external/ (GENERATED,
git-ignored) and every download is md5-verified against the Poly Haven API.
`provenance.json` next to them is the machine record; the human record lives
in each production's ASSET_PROVENANCE.md.

Only environments, furniture, props, textures and HDRIs come from here — never
characters, the ball or anything HNC-branded (those are canonical,
@floodlight/hnc-visuals → blender:export).
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
OUT = REPO / "social" / "blender" / "generated" / "external" / "polyhaven"
API = "https://api.polyhaven.com"

# id -> (kind, resolution). Models come as glTF; textures as diff/rough/nor_gl JPGs.
EXTERNAL = {
    # HDRIs (lighting + blurred backgrounds)
    "sunny_vondelpark": ("hdri", "4k"),
    "cobblestone_street_night": ("hdri", "2k"),
    "suburban_football_field": ("hdri", "8k"),
    "stadium_exterior": ("hdri", "8k"),
    "urban_street_04": ("hdri", "4k"),
    # Textures
    "wood_floor": ("texture", "2k"),
    "white_plaster_02": ("texture", "2k"),
    "oak_veneer_01": ("texture", "2k"),
    "walnut_veneer": ("texture", "2k"),
    "marble_01": ("texture", "2k"),
    "long_white_tiles": ("texture", "2k"),
    "rough_linen": ("texture", "2k"),
    "fabric_leather_02": ("texture", "2k"),
    "concrete_floor_worn_001": ("texture", "2k"),
    "concrete_wall_008": ("texture", "2k"),
    "asphalt_02": ("texture", "2k"),
    "floor_tiles_06": ("texture", "2k"),
    "painted_plaster_wall": ("texture", "2k"),
    # Models (furniture / props)
    "sofa_02": ("model", "2k"),
    "modern_coffee_table_01": ("model", "2k"),
    "dining_chair_02": ("model", "1k"),
    "WoodenTable_02": ("model", "2k"),
    "potted_plant_01": ("model", "1k"),
    "potted_plant_04": ("model", "1k"),
    "standing_picture_frame_01": ("model", "1k"),
    "ClassicNightstand_01": ("model", "1k"),
    "wooden_cutting_board": ("model", "1k"),
    "wooden_bowl_01": ("model", "1k"),
    "lemon": ("model", "1k"),
    "croissant": ("model", "1k"),
    "hamburger_buns": ("model", "1k"),
    "wooden_display_shelves_01": ("model", "1k"),
    "CashRegister_01": ("model", "1k"),
    "wicker_basket_01": ("model", "1k"),
    "modern_arm_chair_01": ("model", "1k"),
    "digital_wrist_watch": ("model", "1k"),
    "concrete_road_barrier": ("model", "1k"),
}


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "hnc-blender-fetch/1"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def _save(url, md5, dest):
    if dest.exists() and hashlib.md5(dest.read_bytes()).hexdigest() == md5:
        return False
    data = _get(url)
    if md5 and hashlib.md5(data).hexdigest() != md5:
        raise RuntimeError(f"md5 mismatch for {url}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return True


def fetch(asset_id, kind, res):
    info = json.loads(_get(f"{API}/info/{asset_id}"))
    files = json.loads(_get(f"{API}/files/{asset_id}"))
    base = OUT / asset_id
    got = []
    if kind == "hdri":
        f = files["hdri"][res]["hdr"]
        _save(f["url"], f["md5"], base / f"{asset_id}_{res}.hdr")
        got.append(f"{asset_id}_{res}.hdr")
    elif kind == "texture":
        for key, name in (("Diffuse", "diff"), ("Rough", "rough"), ("nor_gl", "nor_gl"), ("arm", "arm")):
            if key in files and res in files[key]:
                f = files[key][res].get("jpg") or files[key][res].get("png")
                ext = "jpg" if "jpg" in files[key][res] else "png"
                _save(f["url"], f["md5"], base / f"{asset_id}_{name}_{res}.{ext}")
                got.append(f"{asset_id}_{name}_{res}.{ext}")
    else:
        if "gltf" not in files:
            raise LookupError(f"{asset_id}: no glTF download on Poly Haven")
        res = res if res in files["gltf"] else sorted(files["gltf"])[0]
        g = files["gltf"][res]["gltf"]
        _save(g["url"], g["md5"], base / f"{asset_id}.gltf")
        for rel, f in g.get("include", {}).items():
            _save(f["url"], f["md5"], base / rel)
        got.append(f"{asset_id}.gltf")
    return {
        "id": asset_id,
        "kind": kind,
        "resolution": res,
        "name": info.get("name"),
        "authors": list((info.get("authors") or {}).keys()),
        "license": "CC0 1.0 (Poly Haven)",
        "source": f"https://polyhaven.com/a/{asset_id}",
        "files": got,
    }


def main():
    wanted = sys.argv[1:] or list(EXTERNAL)
    OUT.mkdir(parents=True, exist_ok=True)
    record_path = OUT / "provenance.json"
    record = json.loads(record_path.read_text()) if record_path.exists() else {}
    for asset_id in wanted:
        kind, res = EXTERNAL[asset_id]
        try:
            record[asset_id] = fetch(asset_id, kind, res)
            print(f"{asset_id}: {kind} {res} ok")
        except LookupError as e:
            print(f"SKIP {e}")
        record_path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
