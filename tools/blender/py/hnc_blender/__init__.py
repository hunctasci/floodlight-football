"""HNC Blender pipeline (bpy). Used identically by the headless CLI
(tools/blender/py/hnc_cli.py) and by Claude through the Blender Lab MCP.

MCP usage (interactive Blender):
    import sys; sys.path.insert(0, "<repo>/tools/blender/py")
    import hnc_blender; hnc_blender.reload()
"""
import importlib


def reload():
    """Reload all submodules (the MCP keeps one long-lived Python session)."""
    from . import paths, interchange, scene, inspect_parity, render, studio, plates, plates_the_current
    for mod in (paths, interchange, scene, inspect_parity, render, studio, plates, plates_the_current):
        importlib.reload(mod)
