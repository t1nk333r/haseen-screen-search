# UPSTREAM — `t1nk33r.screen-search`

- **plugin id**: `t1nk33r.screen-search`
- **plugin version**: `0.1.0`
- **declared upstream id** (`omarchy.clonedFrom`): `t1nk33r.screen-search`
- **ownership**: cloned into `~/.config/omarchy/plugins/t1nk33r.screen-search` by `omarchy plugin add` (row in `packages/omarchy-plugins.txt`); its own git repo — **fork repo (origin)**: `https://github.com/t1nk333r/omarchy-screen-search.git`
- **upstream**: original in the owner's own repo (no third-party upstream) — the fork's origin is the owner's own repo, so nothing upstream can be rebased onto
- **tracking branch**: `master` (local HEAD `ce1bee20378e`) against its own `origin`
- **baseline commit**: `2ed1f7cc0cdc83d7f1ccb34eaa575b5d55d5d7dd` = the `origin/master` tip (plan 119 §3) — there is no third-party upstream to drift from; the real baseline for a first-party clone is the installed `omarchy` package (4.0.3)
- **drift at the last report (plans 119–120)**: ahead 2, behind 0

## Fork / local commits (newest first, `refs/upstream/<branch>..HEAD`)

- `ce1bee2 settings: read shell.json instead of the absent shell.shellConfig`
- `1ccbb37 manifest: declare omarchy.clonedFrom (plan 119)`

## Patch records

- none — no unpushed local commit needs recording for this plugin

## Restore / update notes

- Restore: `omarchy plugin add` from the owner's repo restores the current history; `origin master` — 2 commits.
- **Unpushed commits owed** (plan 120's gate, nothing pushed): `origin master` — 2 commits.
- Upstream drift is measured read-only by `~/.local/share/waydots/tools/plugin-upstream-report.sh`; run it before any rebase (plan 119's `plans/notes/119-upstream-status.md` is the pinned baseline).
- Never push a third-party clone; a local rebase of one is a deployment change and belongs in `packages/plugin-patches/`.
- Written by plan 124 (2026-09-11); topology from plan 119, re-verified read-only by plan 124.
