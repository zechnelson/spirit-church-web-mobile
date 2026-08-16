# Sermon Notes History — PRD

## Purpose

Sermon notes currently live in `sessionStorage`, so they're wiped the moment a user closes their browser tab or the browser itself. Since the app has no user accounts, there's no way to recover lost notes. This feature persists notes across sessions using `localStorage`, and additionally lets users browse and revisit notes from past sermons — turning a single ephemeral note pad into a lightweight personal notes archive, with no account required.

## Requirements

- Notes must survive browser close (not just tab navigation, which already works today).
- Notes must be scoped per-sermon so switching weeks never bleeds one week's notes into another, or misaligns chunk notes against a different week's outline.
- Users can see a list of past sermons they took notes on, with title, speaker, and date.
- Selecting a past sermon shows the full outline with notes inline — the same experience as viewing today's message, just for an earlier week.
- Notes on past sermons remain fully editable, same as today's notes.
- Users can delete a past sermon's saved notes to declutter the list.
- The list only shows sermons the user actually took notes on — not a full sermon archive/browse feature.

## Key Decisions

- **`localStorage` over cookies or IndexedDB.** Cookies cap at ~4KB and add request overhead for no benefit (this is purely client-side data). IndexedDB's async API is unnecessary complexity for a few dozen small text records a year. `localStorage`'s ~5-10MB ceiling is nowhere close to a real constraint at this scale.
- **Per-message storage keys (`sermon-notes:{messageId}`), not one archive blob.** Keeps each sermon's notes independently writable — a corrupt or partial write to one message can't damage another's data, and there's no shared index to keep in sync. The list is built by scanning `localStorage` for the key prefix at render time.
- **Outline is snapshotted into the saved record, not re-fetched live from Webflow when viewing a past message.** `chunkNotes` are stored by array index matching the outline's chunk position at note-taking time. If the source Google Doc is edited after publish, a live re-fetch could shift chunk positions and misalign old notes with the wrong line. Snapshotting the outline text alongside the notes at first-save time guarantees permanent alignment and makes past views fully self-contained (no live Webflow dependency, works offline). The snapshot is only captured on the first non-empty note edit — just browsing the outline doesn't create a Past entry.
- **Notes stay editable at any point in their lifecycle.** There's no read-only/locked state for past notes — same `NotesClient` experience regardless of which week is being viewed.
- **No live sync across tabs.** Deleting a past entry in one tab won't update an already-open list in another tab. Acceptable for a single-user, no-accounts feature.

## Scope

**In scope:**
- `lib/notesStorage.ts` — centralized `localStorage` access: `getNotes`, `saveNotes`, `deleteNotes`, `listSavedMessages` (all wrapped in try/catch against malformed JSON, treating parse failures as "not found").
- `NotesClient` generalized to take a required `messageId` prop and read/write through `notesStorage.ts` instead of `sessionStorage`.
- New tab bar (`NotesTabs.tsx`) — "Today's Message" / "Past Messages" — on `/notes` and the new `/notes/past` list route.
- New `/notes/past` route — client-rendered list of saved past sermons (title, speaker, date), with per-row delete.
- New `/notes/past/[id]` route — client-rendered, reads one saved record's snapshot and renders the same outline + notes experience as today's page, with a back link instead of the tab bar.

**Out of scope (for this iteration):**
- Any account system, cloud sync, or cross-device access — notes remain local to one browser.
- Browsing sermons the user never took notes on (that's the existing Events/Church Links surfaces, not this feature).
- Read-only/locked past notes.
- Cross-tab live updates.
- A cap or prune policy on how many past sermons are retained — not a real constraint at this data volume, revisit only if it becomes one.

## Status

**Design approved, not yet implemented.** Next step: implementation plan via `writing-plans`.
