"""HNC Blender pipeline (bpy). Used identically by the headless CLI
(tools/blender/py/hnc_cli.py) and by Claude through the Blender Lab MCP.

MCP usage (interactive Blender):
    import sys; sys.path.insert(0, "<repo>/tools/blender/py")
    import hnc_blender; hnc_blender.reload()
"""
import importlib


def reload():
    """Reload all submodules (the MCP keeps one long-lived Python session), incl. the
    cinematic kit (cine) and the Player Diaries shot builders (diaries)."""
    import sys
    from . import paths, interchange, scene, inspect_parity, render, studio, plates, plates_the_current
    for mod in (paths, interchange, scene, inspect_parity, render, studio, plates, plates_the_current):
        importlib.reload(mod)
    for name in sorted(n for n in sys.modules if n.startswith(("hnc_blender.cine", "hnc_blender.diaries"))):
        importlib.reload(sys.modules[name])
