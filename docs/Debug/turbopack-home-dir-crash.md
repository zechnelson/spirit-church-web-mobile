# Debug: Dev Server Crashing the Computer

**Date resolved:** 2026-05-28
**Symptom:** Running `npm run dev` caused kernel-level system crashes (6 ResetCounter diagnostics in one day; load average reached 53+ on a 10-core M1 Max).

## Root Cause

A stray `~/package.json` (containing `@fal-ai/client`) existed at the home directory root along with `~/package-lock.json` and `~/node_modules`. Turbopack treats any directory with a `package.json` as a workspace root, so it set up FSEvent file watchers across the **entire home directory** — Downloads (831 items), Desktop, Dropbox, Creative Cloud sync folders, iCloud, etc.

Every file change in any of those directories (syncs, downloads, app activity) fired an FSEvent that Turbopack processed, creating runaway CPU load and repeated kernel crashes.

A `turbopack.root` fix was applied earlier in the day (commit `40259ab`) to silence the warning, but the crashes continued because the fix silenced the log message without fully limiting the watcher scope.

## Fix Applied

1. Deleted `~/package.json`, `~/package-lock.json`, and `~/node_modules` — the `@fal-ai/client` package already lived in its proper home at `~/Documents/projects/saltless-content-studio/`.
2. Cleared the `.next` build cache (369MB, including a 295MB Turbopack dev cache) to give Turbopack a clean slate.

## How to Spot This Recurrence

```bash
ls ~/package.json  # should return "No such file"
```

Any `package.json` at `~/` will reproduce the issue. If the dev server starts causing high load again, check this first.

## Diagnostic Signals

| Signal | Value |
| ------ | ----- |
| `~/Library/Logs/DiagnosticReports/` | Multiple `ResetCounter-*.diag` files on same day |
| `top` load average | 50+ on 10-core machine |
| `spotlightknowledged` CPU diags | Spotlight trying to index Turbopack-watched files |
| Dev server startup | Slower than normal, terminal sluggish |
