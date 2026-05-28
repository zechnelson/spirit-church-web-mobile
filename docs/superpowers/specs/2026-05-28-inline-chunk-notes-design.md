# Inline Chunk Notes — Design Spec

**Date:** 2026-05-28
**Workstream:** Sermon Notes
**Status:** Approved

## Overview

Add inline "Add Notes" buttons that break the sermon outline into sections. Each section has its own accordion note input. Notes saved from inline fields append to the same "My Notes" string used by the FAB and bottom editor.

---

## Architecture & Component Breakdown

Three files change, one is new:

| File | Change |
|------|--------|
| `components/notes/SermonOutline.tsx` | Adds chunking logic; renders `InlineNoteChunk` per chunk instead of raw lines; receives `onSaveNote` prop |
| `components/notes/InlineNoteChunk.tsx` | **New.** Owns `isOpen` + `inputValue` state; renders chunk lines, toggle button, and accordion input |
| `components/notes/NotesClient.tsx` | Passes existing `appendNote` down to `SermonOutline` as `onSaveNote` |
| `lib/webflow.ts` | No change — `outlineLines: string[]` stays flat |

The existing text-selection quick-note flow (`onTextSelected`) is untouched. Both live side-by-side.

---

## Chunking Logic

`SermonOutline` splits the flat `lines: string[]` array into chunks before rendering.

**Split signal:** any line matching `/^_{3,}$/` — what Google Docs exports for a horizontal rule in plain text. Verify the exact pattern with a test export during implementation; if it differs the regex is a one-line fix.

**Blank lines** (`""`) remain as spacers *within* a chunk — they are not chunk boundaries.

**Result:** `string[][]` — each inner array is one chunk, passed to one `InlineNoteChunk`.

**Graceful degradation:** If the doc has no horizontal rules, the entire outline is one chunk with one "Add Notes" button at the bottom.

---

## `InlineNoteChunk` Component

### State (local)

| State | Type | Purpose |
|-------|------|---------|
| `isOpen` | `boolean` | Controls accordion visibility |
| `inputValue` | `string` | Current text in the input field |

### Props

| Prop | Type | Purpose |
|------|------|---------|
| `lines` | `string[]` | The chunk's outline lines |
| `onSaveNote` | `(text: string) => void` | Appends text to My Notes |
| `onTextSelected` | `(text: string) => void` | Bubbles text selection up (existing behavior) |

### Rendering

1. Chunk lines using existing line-type styles (quote, heading, bullet, body) — this logic moves from `SermonOutline` into `InlineNoteChunk`
2. Toggle button: `(+) ADD NOTES` when closed → `(+) REMOVE NOTE` when open
3. Accordion: a single-line `<input type="text">` that slides in below the button

### Interactions

| Action | Result |
|--------|--------|
| Tap "Add Notes" | `isOpen = true`, input auto-focuses |
| Return key | Calls `onSaveNote(inputValue)`, clears `inputValue`, field stays open |
| Tap "Remove Note" | `isOpen = false`, unsubmitted input text is discarded |

**Accordion animation:** CSS `max-height` transition (`max-h-0 → max-h-24`) with `overflow-hidden`.

**Why `<input>` not `<textarea>`:** Return on a native iOS `<textarea>` inserts a newline. On `<input type="text">` it fires the Enter `onKeyDown` event cleanly, triggering the save. Long-form notes go in My Notes.

---

## Save Behavior & NotesClient Integration

### Prop chain

```
NotesClient
  └── appendNote(text)  →  passed as onSaveNote
        └── SermonOutline
              └── onSaveNote  →  forwarded to each InlineNoteChunk
```

`appendNote` in `NotesClient` already exists — no logic changes needed there.

### What gets appended

Raw text only — no chunk label or prefix. Consistent with how the FAB quick-note works today.

### Text selection

The `onPointerUp` / text-selection quick-note remains on `SermonOutline`'s container and continues to work independently. The two note-taking paths don't interfere.

### Persistence

Notes still live in React state only (lost on refresh). Out of scope for this feature.

---

## Out of Scope

- Sunday time-gate
- Note persistence (localStorage or server)
- Changes to My Notes modal or bottom NoteEditor
- Removing or modifying existing note-taking paths (FAB, text selection, bottom editor)
