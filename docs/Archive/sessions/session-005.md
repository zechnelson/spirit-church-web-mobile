# Session 005 — Positional chunk notes, label renames

**Workstream:** Sermon Notes
**Date:** 2026-06-06
**Original doc entry:** Session 04

**Goal/Problem:** Inline notes added via "Add Notes" buttons appeared at the very end of the copy/share text instead of after their respective outline chunk. Also renamed UI labels.

**Solution:**
- Changed data model: replaced flat `notes: string` with `freeNotes: string` (freeform textarea) + `chunkNotes: string[]` (indexed by chunk position) in `NotesClient`
- Extracted `chunkLines()` helper into `NotesClient` so chunks are computed once and passed to both `SermonOutline` and `NoteEditor`/`MyNotesModal`
- `appendNote(text, chunkIndex)` now stores notes in `chunkNotes[chunkIndex]`
- `SermonOutline` accepts `chunks: string[][]` prop (no longer computes internally); passes `chunkIndex` to each `InlineNoteChunk`
- `InlineNoteChunk` gains `chunkIndex: number` prop, passes it through all `onSaveNote` calls
- `NoteEditor` builds interleaved share text: when "Include full message notes" is on, each chunk's note (`> note text`) appears directly after its outline lines. When off, all notes (chunk + freeform) concatenate under "── Freeform Notes ──"
- Renamed labels: modal header → **Notes**, section label → **ADDITIONAL NOTES**, share separator → `── Freeform Notes ──`
- Copy/Share buttons now enable when any note exists (chunk or freeform), not just when the textarea has content

**Files Modified:**
- `components/notes/NotesClient.tsx` — `chunkNotes` state, `chunkLines()` helper, `appendNote(text, chunkIndex)`, updated props to children
- `components/notes/SermonOutline.tsx` — accepts `chunks` prop, passes `chunkIndex` to `InlineNoteChunk`, removed internal `chunkLines`
- `components/notes/InlineNoteChunk.tsx` — `chunkIndex` prop, passes through `onSaveNote`
- `components/notes/NoteEditor.tsx` — `outlineChunks` + `chunkNotes` props, interleaved `shareText`, label renames, updated `disabled` condition
- `components/notes/MyNotesModal.tsx` — updated props, header rename

**Status:** Awaiting device testing
