# Session 008 — flushSync fix for Copy/Share disabled on iOS

**Date:** 2026-06-06
**Workstream:** Sermon Notes
**Archived from:** docs/Development/sermon-notes.md (Session 07)

## Goal/Problem

On iOS Safari, the Copy and Share buttons remained grayed out immediately after saving a chunk note. The user saw the "Added to session notes" toast and tapped Copy, but the button was still disabled.

## Root Cause

`toast.success()` fires synchronously via Sonner's own store before React processes the `setChunkNotes` state update. The toast appeared — signalling success — but `NoteEditor` hadn't re-rendered yet, so `hasNotes` was still `false` and the buttons were still disabled. By the time React flushed, the tap had already missed the enabled button.

## Solution

Wrapped `setChunkNotes` in `flushSync()` in `appendNote` so React re-renders `NoteEditor` (enabling Copy/Share) synchronously before `toast.success()` fires.

## Files Modified

- `components/notes/NotesClient.tsx` — added `flushSync` import from `react-dom`; wrapped `setChunkNotes` call in `flushSync()`

## Status

Superseded by Session 10 — `flushSync` does not work inside React 19 discrete event handlers; replaced with `pendingToastRef` + `useEffect` approach.
