# Sermon Notes — Development

## Overview

Live in-person note-taking feature. Users follow the message outline pulled from a Google Doc via Webflow CMS, tap to add quick notes, and can view, edit, copy, or share their notes.

## Key Files

| File | Purpose |
| ---- | ------- |
| `app/(tabs)/notes/page.tsx` | Server page — fetches message from Webflow, renders SermonHeader + NotesClient |
| `lib/webflow.ts` → `getLatestMessage()` | Fetches latest message item, resolves speaker, pulls Google Doc notes |
| `components/notes/NotesClient.tsx` | Client shell — owns `freeNotes` + `chunkNotes` state (sessionStorage-backed), wires all child components |
| `components/notes/SermonOutline.tsx` | Renders Google Doc lines; handles text selection → quick note |
| `components/notes/NoteEditor.tsx` | My Notes textarea + include-sermon toggle + copy/share actions |
| `components/notes/FloatingNoteButton.tsx` | Green FileText FAB — opens Notes modal |
| `components/notes/MyNotesModal.tsx` | 3/4-screen bottom sheet modal wrapping NoteEditor |
| `components/notes/SermonHeader.tsx` | Title, speaker, date display at top of page |
| `components/notes/InlineNoteChunk.tsx` | Renders one outline chunk with inline accordion note input |
| `components/nav/BottomNav.tsx` | Fixed bottom nav (will-change-transform applied for scroll stability) |

## Webflow CMS

- **Collection:** Messages (`68ae1c452c9ac726c7a745fd`)
- **Notes field:** `sermon-notes-download` (Link field — Google Docs URL)
- **Sort:** `lastUpdated` descending so draft items appear
- **Speaker:** resolved via reference to Speakers collection (`68ae1c452c9ac726c7a74691`)
- **Google Doc export:** fetched server-side at `https://docs.google.com/document/d/{id}/export?format=txt`

## Architecture Notes

- Message items can remain **draft** in Webflow — the app fetches by `lastUpdated` so unpublished notes still appear. Publish the item later after adding the video.
- Notes state lives in `NotesClient` as two separate values: `freeNotes: string` (the freeform textarea) and `chunkNotes: string[]` (one entry per outline chunk, indexed by position). Both are backed by `sessionStorage` — persisted across tab navigation, cleared on tab/browser close.
- `NoteEditor` and `MyNotesModal` share both state values — edits in the modal reflect everywhere.
- When sharing with "Include full message notes" on, `chunkNotes[i]` appears directly after chunk `i` in the output (prefixed with `> `). Without the toggle, all chunk notes + freeform notes are concatenated under `── Freeform Notes ──`.

## Sunday Time-Gate

**Planned but not yet implemented.** Design:
- Show current message starting Sunday 6:00 AM `America/Phoenix` (UTC-7, no DST)
- Keep visible all week until the following Sunday at 6:00 AM
- Match by a `Sermon Date` field (Date type) to be added to the Messages collection
- Logic runs server-side in `getLatestMessage()` — compute the most recent Sunday-at-6AM window, fetch the item whose date matches

## Recent Sessions

### Session 07 (2026-06-06) — flushSync fix for Copy/Share disabled on iOS

**Goal/Problem:** On iOS Safari, the Copy and Share buttons remained grayed out immediately after saving a chunk note. The user saw the "Added to session notes" toast and tapped Copy, but the button was still disabled.

**Root Cause:** `toast.success()` fires synchronously via Sonner's own store before React processes the `setChunkNotes` state update. The toast appeared — signalling success — but `NoteEditor` hadn't re-rendered yet, so `hasNotes` was still `false` and the buttons were still disabled. By the time React flushed, the tap had already missed the enabled button.

**Solution:**
- Wrapped `setChunkNotes` in `flushSync()` in `appendNote` so React re-renders `NoteEditor` (enabling Copy/Share) synchronously before `toast.success()` fires.

**Files Modified:**
- `components/notes/NotesClient.tsx` — added `flushSync` import from `react-dom`; wrapped `setChunkNotes` call in `flushSync()`

**Status:** Awaiting device testing

---

### Session 06 (2026-06-06) — Saved chunk notes display in outline

**Goal/Problem:** Notes saved via the per-chunk "Add Notes" accordion were persisted in sessionStorage but not displayed back in the outline after tab navigation. Each `InlineNoteChunk` had only local `inputValue` state starting at `""` — no prop for the already-saved chunk note.

**Solution:**
- Threaded `chunkNotes` from `NotesClient` → `SermonOutline` → `InlineNoteChunk` as a `savedNote: string` prop
- `InlineNoteChunk` now renders a brand-colored left-bordered block (`border-l-2 border-brand-400`) below the outline lines when `savedNote` is non-empty — always visible, no need to open the accordion
- `whitespace-pre-wrap` preserves multi-line notes

**Files Modified:**
- `components/notes/NotesClient.tsx` — passes `chunkNotes` to `SermonOutline`
- `components/notes/SermonOutline.tsx` — accepts `chunkNotes: string[]`, passes `chunkNotes[i]` as `savedNote` to each `InlineNoteChunk`
- `components/notes/InlineNoteChunk.tsx` — accepts `savedNote` prop, renders it when non-empty

**Status:** Awaiting device testing

---

### Session 05 (2026-06-06) — iOS Return key fix, sessionStorage persistence

**Goal/Problem:** (1) Pressing Return on iOS inserted nothing — the keyboard `Enter` event was intercepted to save the note, leaving no way to add a newline on mobile. (2) Notes were lost whenever the user navigated to another tab.

**Solution:**
- Removed `handleKeyDown` from `InlineNoteChunk` entirely — Enter now behaves as a native newline on all platforms. Saving still happens via `onBlur` (iOS "Done" button, tapping away), which was already reliable.
- Added `sessionStorage` persistence to `NotesClient`: both `freeNotes` and `chunkNotes` are read via lazy `useState` initializers on mount and written back via `useEffect` on every change. Keys: `spirit-notes-free`, `spirit-notes-chunks`. Notes survive in-tab navigation but are cleared when the tab or browser closes.

**Files Modified:**
- `components/notes/InlineNoteChunk.tsx` — removed `handleKeyDown`, removed `onKeyDown` prop from textarea
- `components/notes/NotesClient.tsx` — lazy sessionStorage init for both state values, write-back effects

**Status:** Awaiting device testing

### Session 04 (2026-06-06) — Positional chunk notes, label renames

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

### Session 08 (2026-06-06) — First chunk note not saving on iOS (discardRef bug)

**Goal/Problem:** On iOS Safari, the very first note added to the first chunk never saved — tapping outside, hitting the native "Done" button, and pressing Enter all silently dropped the note. Subsequent attempts to the same chunk worked fine.

**Root Cause:** `discardRef.current` was being set to `true` in the `onTouchStart` handler of the toggle button unconditionally — including when the user was *opening* the accordion ("Add Notes"), not just when closing it ("Remove Note"). So on the first open, `handleBlur` would see `discardRef.current === true`, reset it to `false`, and return early — dropping the note. The second blur worked because `discardRef` had already been reset.

**Solution:**
- Added `isOpen` guard: `onMouseDown`/`onTouchStart` on the toggle button now only set `discardRef.current = true` when `isOpen` is already `true` (i.e., when the button is acting as "Remove Note")

**Files Modified:**
- `components/notes/InlineNoteChunk.tsx` — added `if (isOpen)` guard to both `onMouseDown` and `onTouchStart` handlers on the toggle button

**Status:** Awaiting device testing


