# Session 017 — Sermon Notes Session 08 (2026-06-06) — First chunk note not saving on iOS (discardRef bug)

Archived from `docs/Development/sermon-notes.md` (rolling window overflow, 2026-08-16).

**Goal/Problem:** On iOS Safari, the very first note added to the first chunk never saved — tapping outside, hitting the native "Done" button, and pressing Enter all silently dropped the note. Subsequent attempts to the same chunk worked fine.

**Root Cause:** `discardRef.current` was being set to `true` in the `onTouchStart` handler of the toggle button unconditionally — including when the user was *opening* the accordion ("Add Notes"), not just when closing it ("Remove Note"). So on the first open, `handleBlur` would see `discardRef.current === true`, reset it to `false`, and return early — dropping the note. The second blur worked because `discardRef` had already been reset.

**Solution:**
- Added `isOpen` guard: `onMouseDown`/`onTouchStart` on the toggle button now only set `discardRef.current = true` when `isOpen` is already `true` (i.e., when the button is acting as "Remove Note")

**Files Modified:**
- `components/notes/InlineNoteChunk.tsx` — added `if (isOpen)` guard to both `onMouseDown` and `onTouchStart` handlers on the toggle button

**Status:** Awaiting device testing
