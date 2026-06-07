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

### Session 11 (2026-06-06) — Fix hydration mismatch on Copy/Share buttons

**Goal/Problem:** Console hydration error: server rendered buttons as `disabled=""` but client rendered `disabled={false}`. React warned it would not patch the mismatch.

**Root Cause:** The lazy `useState` initializers used `typeof window !== 'undefined'` to conditionally read from `sessionStorage`. On the server, `chunkNotes = []` → `hasNotes = false` → buttons disabled. On the client, if sessionStorage had saved notes, `hasNotes = true` → buttons enabled. This is the exact pattern React flags for hydration mismatches.

**Solution:**
- Replaced lazy `useState` initializers with empty defaults (`""` and `[]`) — server and client start identically
- Added `isHydrated` state (starts `false`)
- Added a mount-only `useEffect` that reads from sessionStorage and calls `setFreeNotes`, `setChunkNotes`, and `setIsHydrated(true)` — all batched into one render
- Write effects now guard with `if (!isHydrated) return` to avoid overwriting sessionStorage with empty defaults before the read completes

**Files Modified:**
- `components/notes/NotesClient.tsx` — replaced lazy useState initializers; added `isHydrated` state; added mount effect for sessionStorage load; added `isHydrated` guard to both write effects

**Status:** Awaiting device testing

---

### Session 10 (2026-06-06) — flushSync removal: toast fires after state commits (React 19)

**Goal/Problem:** Copy/Share buttons remained disabled after saving a chunk note, even though the toast confirmed the save. The `flushSync` fix from Session 07 was not working.

**Root Cause:** In React 19, `flushSync` inside a React discrete event handler (`onBlur`) does not force a mid-handler synchronous re-render. Sonner uses `useSyncExternalStore` internally, which renders the toast synchronously when `toast.success()` is called — but `chunkNotes` hadn't committed yet, so `hasNotes = false` and the buttons were still disabled.

**Solution:**
- Removed `flushSync` from `appendNote` (and `flushSync` import from `react-dom`)
- Added `pendingToastRef` (`useRef<boolean>`) to flag when a toast is pending
- Toast now fires from the existing `useEffect` watching `chunkNotes`, which runs after the state has committed and `hasNotes = true`

**Files Modified:**
- `components/notes/NotesClient.tsx` — removed `flushSync` import and usage; added `pendingToastRef`; moved `toast.success()` into the `chunkNotes` useEffect

**Status:** Awaiting device testing

---

### Session 09 (2026-06-06) — Remove savedNote inline display from outline

**Goal/Problem:** Saved chunk notes were being rendered as a left-bordered block between the outline text and the "Remove Note" button, duplicating the content visibly in the outline while the accordion was open.

**Solution:**
- Removed the `savedNote` render block from `InlineNoteChunk` — the `savedNote` prop is still received (needed for share/copy output) but no longer displayed in the outline UI.

**Files Modified:**
- `components/notes/InlineNoteChunk.tsx` — removed `{savedNote.trim() && <div>...</div>}` block

**Status:** Awaiting device testing

---

### Session 08 (2026-06-06) — First chunk note not saving on iOS (discardRef bug)

**Goal/Problem:** On iOS Safari, the very first note added to the first chunk never saved — tapping outside, hitting the native "Done" button, and pressing Enter all silently dropped the note. Subsequent attempts to the same chunk worked fine.

**Root Cause:** `discardRef.current` was being set to `true` in the `onTouchStart` handler of the toggle button unconditionally — including when the user was *opening* the accordion ("Add Notes"), not just when closing it ("Remove Note"). So on the first open, `handleBlur` would see `discardRef.current === true`, reset it to `false`, and return early — dropping the note. The second blur worked because `discardRef` had already been reset.

**Solution:**
- Added `isOpen` guard: `onMouseDown`/`onTouchStart` on the toggle button now only set `discardRef.current = true` when `isOpen` is already `true` (i.e., when the button is acting as "Remove Note")

**Files Modified:**
- `components/notes/InlineNoteChunk.tsx` — added `if (isOpen)` guard to both `onMouseDown` and `onTouchStart` handlers on the toggle button

**Status:** Awaiting device testing

---

### Session 07 (2026-06-06) — flushSync fix for Copy/Share disabled on iOS

**Goal/Problem:** On iOS Safari, the Copy and Share buttons remained grayed out immediately after saving a chunk note. The user saw the "Added to session notes" toast and tapped Copy, but the button was still disabled.

**Root Cause:** `toast.success()` fires synchronously via Sonner's own store before React processes the `setChunkNotes` state update. The toast appeared — signalling success — but `NoteEditor` hadn't re-rendered yet, so `hasNotes` was still `false` and the buttons were still disabled. By the time React flushed, the tap had already missed the enabled button.

**Solution:**
- Wrapped `setChunkNotes` in `flushSync()` in `appendNote` so React re-renders `NoteEditor` (enabling Copy/Share) synchronously before `toast.success()` fires.

**Files Modified:**
- `components/notes/NotesClient.tsx` — added `flushSync` import from `react-dom`; wrapped `setChunkNotes` call in `flushSync()`

**Status:** Awaiting device testing

