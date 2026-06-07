# Session 007 — Saved chunk notes display in outline

**Date:** 2026-06-06
**Workstream:** Sermon Notes
**Archived from:** docs/Development/sermon-notes.md (Session 06)

## Goal/Problem

Notes saved via the per-chunk "Add Notes" accordion were persisted in sessionStorage but not displayed back in the outline after tab navigation.

## Solution

- Threaded `chunkNotes` from `NotesClient` → `SermonOutline` → `InlineNoteChunk` as a `savedNote: string` prop
- `InlineNoteChunk` rendered a brand-colored left-bordered block when `savedNote` was non-empty (later removed in Session 09)

## Files Modified

- `components/notes/NotesClient.tsx` — passes `chunkNotes` to `SermonOutline`
- `components/notes/SermonOutline.tsx` — accepts `chunkNotes: string[]`, passes `chunkNotes[i]` as `savedNote` to each `InlineNoteChunk`
- `components/notes/InlineNoteChunk.tsx` — accepts `savedNote` prop

## Status

Superseded by Session 09 (inline display block removed)
