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

### Session 03 (2026-06-06) — Inline note save fixes, toast feedback

**Goal/Problem:** Several bugs with the `InlineNoteChunk` note input: (1) iOS "Done" keyboard button didn't save the note, (2) tapping out of the field cleared the draft, (3) no user feedback when a note was saved.

**Solution:**
- Added `onBlur` to `InlineNoteChunk` to save on keyboard dismiss (iOS "Done" fires `blur`, not a keydown)
- Added `discardRef` (set on `onMouseDown`/`onTouchStart` of the "Remove Note" button) to prevent blur from accidentally saving when the user intentionally discards
- Added `lastSavedRef` to track the last saved value — field no longer clears after save, and duplicate saves are skipped if content hasn't changed
- Plain **Enter** saves the note; **⌘↵ / Ctrl+Enter** inserts a newline (manually handled since the textarea is a controlled component)
- Installed `sonner` and added `<Toaster position="top-center" richColors />` to root layout
- Toast "Added to session notes" fires in `appendNote` in `NotesClient` — covers all current and future note-save paths centrally

**Files Modified:**
- `components/notes/InlineNoteChunk.tsx` — `onBlur`, `discardRef`, `lastSavedRef`, Enter/⌘↵ keyboard handling
- `components/notes/NotesClient.tsx` — toast call in `appendNote`
- `app/layout.tsx` — `<Toaster>` added
- `package.json` — `sonner` added

**Status:** Awaiting device testing

### Session 02 (2026-05-29) — Inline note chunks, FAB cleanup

**Goal:** Replace the floating green plus FAB quick-note sheet with per-chunk inline note inputs directly in the outline.

**Solution:**
- Refactored `SermonOutline` to split outline lines on `---`/`___` separator lines into chunks, rendering each as an `InlineNoteChunk`
- `InlineNoteChunk` renders its lines then shows a full-width "Add Notes" secondary button; tapping it accordions open a 4-row textarea (⌘↵ to save). The `+` icon rotates 45° to an `×` and the label switches to "Remove Note" when open.
- Removed `FloatingNoteButton` quick-note sheet (green plus FAB + slide-up modal) entirely — now just the green FileText FAB that opens the My Notes modal
- Cleaned up dead `selectedText`/`onTextSelected` prop chain from `NotesClient` → `SermonOutline` → `InlineNoteChunk`

**Files Modified:**
- `components/notes/InlineNoteChunk.tsx` — new file
- `components/notes/SermonOutline.tsx` — chunk splitting, delegates to `InlineNoteChunk`
- `components/notes/FloatingNoteButton.tsx` — stripped to FileText FAB only, now green
- `components/notes/NotesClient.tsx` — removed selectedText state, clearSelection, dead props

**Status:** VERIFIED WORKING

### Session 01 (2026-05-15) — Webflow connection, My Notes modal, nav fix

**Goal:** Connect sermon notes to Webflow CMS, add quick-access My Notes modal, fix bottom nav scroll bug.

**Solution:**
- Fixed `getLatestMessage()` field name (`message-notes-link` → `sermon-notes-download`) and sort (`lastPublished` → `lastUpdated`) so draft items appear
- Added `will-change-transform` to `BottomNav` to prevent the nav from shrinking when the mobile browser address bar hides on scroll
- Added `MyNotesModal` — 3/4-screen bottom sheet with backdrop, triggered by a new secondary FAB (white circle, `FileText` icon) positioned above the green plus FAB. Modal wraps the full `NoteEditor` component and shares `notes` state from `NotesClient`.

**Files Modified:**
- `lib/webflow.ts` — field name + sort fix
- `components/nav/BottomNav.tsx` — `will-change-transform`
- `components/notes/FloatingNoteButton.tsx` — secondary FAB added
- `components/notes/NotesClient.tsx` — modal state wired up
- `components/notes/MyNotesModal.tsx` — new file

**Status:** VERIFIED WORKING
