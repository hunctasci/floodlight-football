"""Repository paths + the write-safety guard for all HNC Blender automation.

Blender Python (CLI or MCP) must only read/write inside the HNC repository.
Every path that is written goes through ``inside_repo``.
"""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
WORKSPACE = REPO_ROOT / "social" / "blender"
GENERATED = WORKSPACE / "generated"
MANIFEST = GENERATED / "manifest.json"
VERIFICATION = WORKSPACE / "verification"
RENDERS = VERIFICATION / "renders"
PARITY_BLEND = VERIFICATION / "hnc-parity.blend"
PARITY_REPORT = VERIFICATION / "parity-report.json"
LIBRARY_BLEND = WORKSPACE / "library" / "hnc-cinematic-base.blend"


def inside_repo(path) -> Path:
    """Resolve ``path`` and refuse anything outside the repository."""
    p = Path(path).resolve()
    if p != REPO_ROOT and REPO_ROOT not in p.parents:
        raise PermissionError(f"Refusing path outside the HNC repository: {p}")
    return p


def rel(path) -> str:
    """Repository-relative POSIX path (reports never embed machine paths)."""
    return Path(path).resolve().relative_to(REPO_ROOT).as_posix()
