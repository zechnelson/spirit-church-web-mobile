# Sermon Notes — Development

## Overview

Live in-person note-taking feature. Users follow the message outline pulled from a Google Doc via Webflow CMS, tap to add quick notes, and can view, edit, copy, or share their notes.

## Key Files

| File | Purpose |
| ---- | ------- |
| `app/(tabs)/notes/page.tsx` | Server page — fetches message from Webflow, renders SermonHeader + NotesClient |
| `lib/webflow.ts` → `getLatestMessage()` | Fetches latest message item, resolves speaker, pulls Google Doc notes |
| `components/notes/NotesClient.tsx` | Client shell — owns `freeNotes` + `chunkNotes` state (localStorage-backed via `lib/notesStorage.ts`, keyed per `messageId`), wires all child components |
| `components/notes/SermonOutline.tsx` | Renders Google Doc lines; handles text selection → quick note |
| `components/notes/NoteEditor.tsx` | My Notes textarea + include-sermon toggle + copy/share actions |
| `components/notes/FloatingNoteButton.tsx` | Green FileText FAB — opens Notes modal |
| `components/notes/MyNotesModal.tsx` | 3/4-screen bottom sheet modal wrapping NoteEditor |
| `components/notes/SermonHeader.tsx` | Title, speaker, date display at top of page; accepts `eyebrow` prop (defaults to "Today's Message", set to "Past Message" on past-entry pages) |
| `components/notes/InlineNoteChunk.tsx` | Renders one outline chunk with inline accordion note input |
| `components/notes/NotesTabs.tsx` | "Today's Message" / "Past Messages" pill tab bar, active state driven by `usePathname()` |
| `components/notes/PastMessagesList.tsx` | Lists all saved-notes records (excluding the current message), tap to view, trash icon to delete; empty state when none exist |
| `lib/notesStorage.ts` | localStorage read/write/list/delete helpers, keyed `sermon-notes:{messageId}` |
| `app/(tabs)/notes/past/page.tsx` | Server page — renders `NotesTabs` + `PastMessagesList` |
| `app/(tabs)/notes/past/[id]/page.tsx` | Client page — loads a saved record by id from `lib/notesStorage.ts`, renders `SermonHeader` (Past Message eyebrow) + `NotesClient`, redirects to `/notes/past` if the id isn't found |
| `components/nav/BottomNav.tsx` | Fixed bottom nav (will-change-transform applied for scroll stability) |

## Webflow CMS

- **Collection:** Messages (`68ae1c452c9ac726c7a745fd`)
- **Notes field:** `sermon-notes-download` (Link field — Google Docs URL)
- **Sort:** `lastUpdated` descending so draft items appear
- **Speaker:** resolved via reference to Speakers collection (`68ae1c452c9ac726c7a74691`)
- **Google Doc export:** fetched server-side at `https://docs.google.com/document/d/{id}/export?format=txt`

## Architecture Notes

- Message items can remain **draft** in Webflow — the app fetches by `lastUpdated` so unpublished notes still appear. Publish the item later after adding the video.
- Notes state lives in `NotesClient` as two separate values: `freeNotes: string` (the freeform textarea) and `chunkNotes: string[]` (one entry per outline chunk, indexed by position). As of the notes-history session, both are backed by per-message `localStorage` (`lib/notesStorage.ts`, key `sermon-notes:{messageId}`) — notes now survive full browser close/reopen, not just tab navigation. `NotesClient` is generalized to accept any `messageId`/`title`/`speaker`/`date`/`outlineLines`, so the same component renders both `/notes` (today's message) and `/notes/past/[id]` (a saved past message). When both `freeNotes` and every entry of `chunkNotes` are empty, the record's localStorage key is deleted outright rather than left behind as an empty record.
- `NoteEditor` and `MyNotesModal` share both state values — edits in the modal reflect everywhere.
- When sharing with "Include full message notes" on, `chunkNotes[i]` appears directly after chunk `i` in the output (prefixed with `> `). Without the toggle, all chunk notes + freeform notes are concatenated under `── Freeform Notes ──`.

## Sunday Time-Gate

**Planned but not yet implemented.** Design:
- Show current message starting Sunday 6:00 AM `America/Phoenix` (UTC-7, no DST)
- Keep visible all week until the following Sunday at 6:00 AM
- Match by a `Sermon Date` field (Date type) to be added to the Messages collection
- Logic runs server-side in `getLatestMessage()` — compute the most recent Sunday-at-6AM window, fetch the item whose date matches

## Recent Sessions

### Session 13 (2026-08-16) — Sermon notes history: localStorage persistence + Past Messages

**Goal/Problem:** Notes were backed by `sessionStorage`, so they were wiped on browser close and there was no way to revisit notes from a previous week's message — only the single current message's notes existed at any time.

**Solution:**
- Added `lib/notesStorage.ts` — localStorage-backed CRUD module keyed `sermon-notes:{messageId}` (`getNotes`, `saveNotes`, `deleteNotes`, `listSavedMessages`); records store `messageId`, `title`, `speaker`, `date`, `outlineLines`, `freeNotes`, `chunkNotes`, `updatedAt`
- Added `AppMessage.id` (exposed from `lib/webflow.ts`'s `getLatestMessage()`) so each message has a stable id to key notes by
- Generalized `NotesClient` to accept `messageId`/`sermonTitle`/`speaker`/`date`/`outlineLines` as props instead of hardcoding "today's message" — it now reads/writes via `lib/notesStorage.ts` instead of `sessionStorage`, and deletes the record entirely (rather than leaving an empty one behind) when both `freeNotes` and all `chunkNotes` are empty
- Added `eyebrow` prop to `SermonHeader` (defaults to "Today's Message"; past-entry pages pass "Past Message")
- Added `NotesTabs` — "Today's Message" / "Past Messages" pill tab bar (active state via `usePathname()`), rendered on both `/notes` and `/notes/past`
- Added `PastMessagesList` — lists all saved records except the current message (via `listSavedMessages(excludeMessageId)`), tap a row to open `/notes/past/[id]`, trash icon deletes via `deleteNotes()`; shows an empty state when no past notes exist
- Added `/notes/past` route (server page — fetches current message just to get its id for exclusion, renders `NotesTabs` + `PastMessagesList`)
- Added `/notes/past/[id]` route (client page — loads the record by id via `getNotes()`, redirects back to `/notes/past` if not found, renders `SermonHeader` with "Past Message" eyebrow + a working "← Past Messages" back link + `NotesClient`)
- Wired `/notes` (today's page) to pass `message.id` through to `NotesClient` and render `NotesTabs` above the header

**Verification:** Full 8-step manual smoke test run via Playwright MCP against the real Webflow-backed dev server (not mocked data) — added chunk + freeform notes, confirmed persistence across a hard reload and after clearing `sessionStorage` (core bug fix), confirmed the empty state on Past Messages when only today's message has notes, injected a synthetic past record directly into `localStorage` to exercise the past-detail route without waiting a week, confirmed its eyebrow/back-link/outline/notes render correctly, edited and re-confirmed persistence, deleted it via the list's trash icon and confirmed both UI and `localStorage` reflect the deletion, and confirmed that clearing all notes on today's message removes its `localStorage` key entirely rather than leaving an empty record.

**Known gap (pre-existing, not introduced by this work):** `InlineNoteChunk`'s "Remove Note" button only discards an unsaved draft and closes the accordion — it does not clear a previously-saved chunk note's content. There is no UI affordance to delete an individual saved chunk note (whole-message deletion via the Past Messages trash icon is the only way to remove chunk note content). Confirmed via `git diff` against the merge-base that this file is unchanged by the notes-history work.

**Files Modified:**
- `lib/webflow.ts` — added `id` to `AppMessage`
- `lib/notesStorage.ts` — new file, localStorage CRUD module
- `components/notes/NotesClient.tsx` — generalized to accept `messageId`/`sermonTitle`/`speaker`/`date`/`outlineLines` props; switched from `sessionStorage` to `lib/notesStorage.ts`; deletes record when content is fully empty; guards against resaving on mere hydration
- `components/notes/SermonHeader.tsx` — added `eyebrow` prop
- `components/notes/NotesTabs.tsx` — new file
- `components/notes/PastMessagesList.tsx` — new file
- `app/(tabs)/notes/page.tsx` — passes `message.id` to `NotesClient`, renders `NotesTabs`
- `app/(tabs)/notes/past/page.tsx` — new file
- `app/(tabs)/notes/past/[id]/page.tsx` — new file

**Status:** Verified end-to-end against the real dev server and Webflow data; automated suite green (23/23 tests, `tsc --noEmit` clean). `npm run lint` has pre-existing failures (`react-hooks/set-state-in-effect`) predating this branch in untouched files (`HeroBannerClient.tsx`, `NoteEditor.tsx`); this branch's two new instances of the same pattern (`PastMessagesList.tsx`, `app/(tabs)/notes/past/[id]/page.tsx`) follow the existing codebase convention and were not introduced as new lint debt beyond that pattern.

---

### Session 12 (2026-06-06) — Default "Include full message notes" toggle to on

**Goal/Problem:** The "Include full message notes" toggle in NoteEditor defaulted to off, requiring users to manually enable it before copying or sharing.

**Solution:**
- Changed `useState(false)` to `useState(true)` for `includeSermon` in `NoteEditor`

**Files Modified:**
- `components/notes/NoteEditor.tsx` — `includeSermon` initial state changed from `false` to `true`

**Status:** Awaiting device testing

---

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


