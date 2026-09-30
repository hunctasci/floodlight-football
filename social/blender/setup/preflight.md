# Blender pipeline — Phase 0 preflight

Recorded: 2026-09-30 (first run of the Blender/MCP infrastructure setup).

## Repository state (source baseline)

| Item | Value |
|---|---|
| Branch | `reel-factory` |
| HEAD | `b0a78bef5d57e28e8ea5bb042e43102eeb40fa09` ("commit", 2026-09-29) |
| Modified files | none |
| Untracked files | none (`git status --porcelain --untracked-files=all` → 0 lines) |
| Stashes | none |
| `git diff --stat` | empty |

The setup brief expected valuable *uncommitted* campaign work on `reel-factory`.
At preflight time the working tree was **clean**: that work had already been committed
by the owner in the four "commit" commits on top of `af9686d` (the last one, `b0a78be`,
touches `packages/reels` audio/stems, campaign overview and autumn-2026 content).
The current `HEAD` is therefore the source baseline for this setup.

Recent history:

```
b0a78be commit
85d04c4 commit
1711498 commit
363334f commit
af9686d Add HNC hero trailer and SFX stems
d8af367 second
8280ae9 initial commit
```

## Operations deliberately NOT performed

No checkout, merge, rebase, stash, reset, clean, commit or push.
All changes from this setup are additive and are tracked file-by-file in
`SETUP_STATE.md`.

## Existing ignore rules relevant to the new pipeline

- `social/output/` — generated social media (ignored)
- `packages/reels/public/generated/` — generated audio stems (ignored)

## Run 2 (after Claude Code restart)

State at the start of run 2: branch `reel-factory`, HEAD `b0a78be` (unchanged), no modified
tracked files, untracked only `social/blender/setup/*` (run-1 reports). Again no checkout,
merge, rebase, stash, reset, clean, commit or push. All run-2 changes are listed in
`SETUP_STATE.md`.
