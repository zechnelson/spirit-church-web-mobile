# Sermon Notes History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist sermon notes across browser sessions via `localStorage` (keyed per-sermon), and add a "Past Messages" tab so users can browse, edit, and delete notes from earlier sermons.

**Architecture:** A new `lib/notesStorage.ts` module owns all `localStorage` access behind a small function API (`getNotes`, `saveNotes`, `deleteNotes`, `listSavedMessages`). `NotesClient` is generalized to take a `messageId` and read/write through that module instead of `sessionStorage`, snapshotting the outline text into the saved record on first non-empty edit. Two new routes (`/notes/past` and `/notes/past/[id]`) render a list of saved sermons and a single past sermon's notes, reusing the existing `SermonHeader` and `NotesClient` components — no new Webflow fetch is needed for past views since everything a past view needs is already in the local snapshot.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest (Node environment, no jsdom — component behavior is verified manually via dev server per project convention), lucide-react icons.

**Spec:** `docs/PRDs/sermon-notes-history.md`

## Global Constraints

- Storage key format is exactly `sermon-notes:{messageId}` — every read/write/scan in `notesStorage.ts` must use this prefix consistently.
- `localStorage` only — no cookies, no IndexedDB.
- No accounts, no cloud sync — notes are local to one browser.
- Past notes are always fully editable — no read-only/locked state.
- No cross-tab live sync — acceptable for a single-user, no-accounts feature.
- The outline is snapshotted into the saved record on first non-empty edit, and never re-fetched live from Webflow for past views (avoids `chunkNotes` index misalignment if the source Google Doc changes after publish).
- A record is only written once its content is non-empty (`freeNotes` non-blank or any `chunkNotes` entry non-blank); if content is cleared back to empty, the record is deleted — no blank entries in the Past list.
- The Past list is sorted by `updatedAt` (most recently edited first), not by the display `date` string — `formatDate()` in `lib/webflow.ts` produces strings like `"Sun, Jun 7"` with no year, which do not sort chronologically as plain strings.

---

### Task 1: Add `id` to `AppMessage`

**Files:**
- Modify: `lib/webflow.ts:51-56` (interface), `lib/webflow.ts:164-169` (return object)

**Interfaces:**
- Produces: `AppMessage.id: string` — the Webflow item ID, consumed by `app/(tabs)/notes/page.tsx` in Task 5 to pass `messageId` into `NotesClient`.

There's no existing unit test for `getLatestMessage()` (it does a live Webflow fetch, matching the project's existing convention of only unit-testing pure logic — see `lib/__tests__/sunday-hero.test.ts`). Verification here is a type check.

- [ ] **Step 1: Add `id` to the `AppMessage` interface**

In `lib/webflow.ts`, change:

```ts
export interface AppMessage {
  title: string;
  speaker: string;
  date: string;
  outlineLines: string[];
}
```

to:

```ts
export interface AppMessage {
  id: string;
  title: string;
  speaker: string;
  date: string;
  outlineLines: string[];
}
```

- [ ] **Step 2: Return `id` from `getLatestMessage()`**

In `lib/webflow.ts`, change the return statement inside `getLatestMessage()`:

```ts
  return {
    title: fd.name as string,
    speaker,
    date: formatDate(fd.date as string | null),
    outlineLines,
  };
```

to:

```ts
  return {
    id: item.id,
    title: fd.name as string,
    speaker,
    date: formatDate(fd.date as string | null),
    outlineLines,
  };
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors (any errors would indicate another place constructs an `AppMessage` without `id` — there are none today, but confirm).

- [ ] **Step 4: Commit**

```bash
git add lib/webflow.ts
git commit -m "feat(webflow): expose message id on AppMessage"
```

---

### Task 2: Build `lib/notesStorage.ts` (TDD)

**Files:**
- Create: `lib/notesStorage.ts`
- Test: `lib/__tests__/notesStorage.test.ts`

**Interfaces:**
- Produces:
  - `interface SavedNotesRecord { messageId: string; title: string; speaker: string; date: string; outlineLines: string[]; freeNotes: string; chunkNotes: string[]; updatedAt: string }`
  - `interface SavedMessageSummary { messageId: string; title: string; speaker: string; date: string }`
  - `getNotes(messageId: string): SavedNotesRecord | null`
  - `saveNotes(record: SavedNotesRecord): void`
  - `deleteNotes(messageId: string): void`
  - `listSavedMessages(excludeMessageId?: string): SavedMessageSummary[]` — sorted by `updatedAt` descending, malformed entries silently skipped.
- Consumes: nothing (leaf module, only depends on the browser `localStorage` global).

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/notesStorage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  getNotes,
  saveNotes,
  deleteNotes,
  listSavedMessages,
  type SavedNotesRecord,
} from "../notesStorage";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

function record(overrides: Partial<SavedNotesRecord> = {}): SavedNotesRecord {
  return {
    messageId: "msg-1",
    title: "Faith Over Fear",
    speaker: "Pastor Sam",
    date: "Sun, Jun 7",
    outlineLines: ["Line one", "Line two"],
    freeNotes: "great sermon",
    chunkNotes: ["note on line one"],
    updatedAt: "2026-06-07T16:00:00.000Z",
    ...overrides,
  };
}

describe("notesStorage", () => {
  it("returns null when no record is saved for a message", () => {
    expect(getNotes("missing")).toBeNull();
  });

  it("round-trips a saved record", () => {
    saveNotes(record());
    expect(getNotes("msg-1")).toEqual(record());
  });

  it("returns null for malformed JSON instead of throwing", () => {
    localStorage.setItem("sermon-notes:msg-1", "{not valid json");
    expect(getNotes("msg-1")).toBeNull();
  });

  it("deletes a saved record", () => {
    saveNotes(record());
    deleteNotes("msg-1");
    expect(getNotes("msg-1")).toBeNull();
  });

  it("deleteNotes is a no-op when nothing was saved", () => {
    expect(() => deleteNotes("never-saved")).not.toThrow();
  });

  it("lists saved messages sorted by most recently updated first", () => {
    saveNotes(record({ messageId: "older", updatedAt: "2026-06-01T00:00:00.000Z" }));
    saveNotes(record({ messageId: "newer", updatedAt: "2026-06-08T00:00:00.000Z" }));

    const list = listSavedMessages();

    expect(list.map((m) => m.messageId)).toEqual(["newer", "older"]);
  });

  it("excludes the given messageId from the list", () => {
    saveNotes(record({ messageId: "current" }));
    saveNotes(record({ messageId: "past-one" }));

    const list = listSavedMessages("current");

    expect(list.map((m) => m.messageId)).toEqual(["past-one"]);
  });

  it("skips malformed entries when listing", () => {
    saveNotes(record({ messageId: "good" }));
    localStorage.setItem("sermon-notes:bad", "{not valid json");

    const list = listSavedMessages();

    expect(list.map((m) => m.messageId)).toEqual(["good"]);
  });

  it("ignores localStorage keys outside the sermon-notes prefix", () => {
    localStorage.setItem("some-other-app-key", "hello");
    saveNotes(record());

    const list = listSavedMessages();

    expect(list).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/notesStorage.test.ts`
Expected: FAIL — `../notesStorage` module not found.

- [ ] **Step 3: Write the implementation**

Create `lib/notesStorage.ts`:

```ts
const KEY_PREFIX = "sermon-notes:";

export interface SavedNotesRecord {
  messageId: string;
  title: string;
  speaker: string;
  date: string;
  outlineLines: string[];
  freeNotes: string;
  chunkNotes: string[];
  updatedAt: string;
}

export interface SavedMessageSummary {
  messageId: string;
  title: string;
  speaker: string;
  date: string;
}

function keyFor(messageId: string): string {
  return `${KEY_PREFIX}${messageId}`;
}

export function getNotes(messageId: string): SavedNotesRecord | null {
  const raw = localStorage.getItem(keyFor(messageId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedNotesRecord;
  } catch {
    return null;
  }
}

export function saveNotes(record: SavedNotesRecord): void {
  localStorage.setItem(keyFor(record.messageId), JSON.stringify(record));
}

export function deleteNotes(messageId: string): void {
  localStorage.removeItem(keyFor(messageId));
}

export function listSavedMessages(excludeMessageId?: string): SavedMessageSummary[] {
  const records: SavedNotesRecord[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(KEY_PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as SavedNotesRecord;
      if (parsed.messageId === excludeMessageId) continue;
      records.push(parsed);
    } catch {
      continue;
    }
  }
  return records
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .map(({ messageId, title, speaker, date }) => ({ messageId, title, speaker, date }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/notesStorage.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/notesStorage.ts lib/__tests__/notesStorage.test.ts
git commit -m "feat(notes): add localStorage-backed notesStorage module"
```

---

### Task 3: Generalize `NotesClient` to use `notesStorage`

**Files:**
- Modify: `components/notes/NotesClient.tsx` (full file, currently 101 lines)

**Interfaces:**
- Consumes: `getNotes`, `saveNotes`, `deleteNotes` from `lib/notesStorage` (Task 2).
- Produces: `NotesClientProps` now requires `messageId: string` and `date: string` in addition to the existing `sermonTitle`, `speaker`, `outlineLines` — consumed by Task 5 (`/notes/page.tsx`) and Task 7 (`/notes/past/[id]/page.tsx`).

No jsdom/React Testing Library is set up in this project (`vitest.config.ts` uses `environment: "node"`), matching the existing convention of not unit-testing components. This task is verified via type check plus the manual end-to-end pass in Task 8.

- [ ] **Step 1: Replace the props interface and storage calls**

Replace the full contents of `components/notes/NotesClient.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SermonOutline } from "./SermonOutline";
import { NoteEditor } from "./NoteEditor";
import { FloatingNoteButton } from "./FloatingNoteButton";
import { MyNotesModal } from "./MyNotesModal";
import { getNotes, saveNotes, deleteNotes } from "@/lib/notesStorage";

interface NotesClientProps {
  messageId: string;
  sermonTitle: string;
  speaker: string;
  date: string;
  outlineLines: string[];
}

function chunkLines(lines: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^[_-]{3,}$/.test(line.trim())) {
      if (current.length > 0) chunks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks.length > 0 ? chunks : [lines];
}

export function NotesClient({ messageId, sermonTitle, speaker, date, outlineLines }: NotesClientProps) {
  const [freeNotes, setFreeNotes] = useState<string>("");
  const [chunkNotes, setChunkNotes] = useState<string[]>([]);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const pendingToastRef = useRef(false);

  useEffect(() => {
    const record = getNotes(messageId);
    if (record) {
      setFreeNotes(record.freeNotes);
      setChunkNotes(record.chunkNotes);
    } else {
      setFreeNotes("");
      setChunkNotes([]);
    }
    setIsHydrated(true);
  }, [messageId]);

  useEffect(() => {
    if (!isHydrated) return;
    const hasContent = freeNotes.trim() !== "" || chunkNotes.some((c) => c?.trim());
    if (hasContent) {
      saveNotes({
        messageId,
        title: sermonTitle,
        speaker,
        date,
        outlineLines,
        freeNotes,
        chunkNotes,
        updatedAt: new Date().toISOString(),
      });
    } else {
      deleteNotes(messageId);
    }
    if (pendingToastRef.current) {
      pendingToastRef.current = false;
      toast.success("Notes saved");
    }
  }, [freeNotes, chunkNotes, isHydrated, messageId, sermonTitle, speaker, date, outlineLines]);

  const chunks = chunkLines(outlineLines);

  const appendNote = (text: string, chunkIndex: number) => {
    pendingToastRef.current = true;
    setChunkNotes((prev) => {
      const next = [...prev];
      next[chunkIndex] = prev[chunkIndex]?.trim()
        ? `${prev[chunkIndex]}\n${text}`
        : text;
      return next;
    });
  };

  return (
    <>
      <SermonOutline chunks={chunks} chunkNotes={chunkNotes} onSaveNote={appendNote} />
      <NoteEditor
        notes={freeNotes}
        onNotesChange={setFreeNotes}
        sermonTitle={sermonTitle}
        speaker={speaker}
        outlineChunks={chunks}
        chunkNotes={chunkNotes}
      />
      <FloatingNoteButton
        onOpenNotesModal={() => setIsNotesModalOpen(true)}
      />
      <MyNotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        notes={freeNotes}
        onNotesChange={setFreeNotes}
        sermonTitle={sermonTitle}
        speaker={speaker}
        outlineChunks={chunks}
        chunkNotes={chunkNotes}
      />
    </>
  );
}
```

Note this drops the two-key `sessionStorage` split (`spirit-notes-free` / `spirit-notes-chunks`) entirely in favor of one combined record per message via `notesStorage`. The hydration-safe pattern (empty initial state, mount-effect load, `isHydrated` guard) from Session 11 is preserved.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: errors at every current call site of `<NotesClient>` (they don't yet pass `messageId`/`date`) — confirms the interface change took effect. These call sites get fixed in Tasks 5 and 7.

- [ ] **Step 3: Commit**

```bash
git add components/notes/NotesClient.tsx
git commit -m "feat(notes): generalize NotesClient to use localStorage via messageId"
```

---

### Task 4: `SermonHeader` eyebrow prop + `NotesTabs` component

**Files:**
- Modify: `components/notes/SermonHeader.tsx:1-29`
- Create: `components/notes/NotesTabs.tsx`

**Interfaces:**
- Produces: `SermonHeaderProps.eyebrow?: string` (default `"Today's Message"`) — consumed by Task 7's past-message view (`eyebrow="Past Message"`).
- Produces: `NotesTabs` — no props, renders a two-tab nav bar, consumed by Tasks 5 and 6.

- [ ] **Step 1: Add the `eyebrow` prop to `SermonHeader`**

Replace `components/notes/SermonHeader.tsx`:

```tsx
interface SermonHeaderProps {
  title: string;
  speaker: string;
  date: string;
  scripture?: string;
  eyebrow?: string;
}

export function SermonHeader({
  title,
  speaker,
  date,
  scripture,
  eyebrow = "Today's Message",
}: SermonHeaderProps) {
  return (
    <div className="px-4 pb-5 pt-6">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brand-500">
        {eyebrow}
      </p>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink-900">
        {title}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {speaker && <span className="text-[13px] text-ink-600">{speaker}</span>}
        {speaker && date && <span className="text-ink-300">·</span>}
        {date && <span className="text-[13px] text-ink-600">{date}</span>}
      </div>
      {scripture && (
        <div className="mt-3 inline-flex items-center rounded-full bg-brand-50 px-3 py-1">
          <span className="text-[12px] font-medium text-brand-700">{scripture}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `NotesTabs.tsx`**

Create `components/notes/NotesTabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NotesTabs() {
  const pathname = usePathname();
  const isPast = pathname?.startsWith("/notes/past") ?? false;

  return (
    <div className="mx-4 mb-2 mt-4 flex gap-1 rounded-full bg-ink-50 p-1">
      <Link
        href="/notes"
        className={`flex-1 rounded-full py-2 text-center text-[13px] font-semibold transition-colors ${
          !isPast ? "bg-white text-ink-900 shadow-sm" : "text-ink-600"
        }`}
      >
        Today&apos;s Message
      </Link>
      <Link
        href="/notes/past"
        className={`flex-1 rounded-full py-2 text-center text-[13px] font-semibold transition-colors ${
          isPast ? "bg-white text-ink-900 shadow-sm" : "text-ink-600"
        }`}
      >
        Past Messages
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no new errors from these two files (existing `NotesClient` call-site errors from Task 3 remain until Tasks 5/7).

- [ ] **Step 4: Commit**

```bash
git add components/notes/SermonHeader.tsx components/notes/NotesTabs.tsx
git commit -m "feat(notes): add SermonHeader eyebrow prop and NotesTabs component"
```

---

### Task 5: Wire `/notes` (Today's Message) to `messageId` + `NotesTabs`

**Files:**
- Modify: `app/(tabs)/notes/page.tsx:1-31`

**Interfaces:**
- Consumes: `AppMessage.id` (Task 1), `NotesClientProps.messageId`/`date` (Task 3), `NotesTabs` (Task 4).

- [ ] **Step 1: Update the page to pass `messageId`/`date` and render `NotesTabs`**

Replace `app/(tabs)/notes/page.tsx`:

```tsx
import { SermonHeader } from "@/components/notes/SermonHeader";
import { NotesClient } from "@/components/notes/NotesClient";
import { NotesTabs } from "@/components/notes/NotesTabs";
import { getLatestMessage } from "@/lib/webflow";

export default async function NotesPage() {
  const message = await getLatestMessage().catch(() => null);

  if (!message) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
        <p className="text-[15px] font-semibold text-ink-900">No message available</p>
        <p className="mt-2 text-[13px] text-ink-600">Check back after Sunday&apos;s service.</p>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <NotesTabs />
      <SermonHeader
        title={message.title}
        speaker={message.speaker}
        date={message.date}
      />
      <NotesClient
        messageId={message.id}
        sermonTitle={message.title}
        speaker={message.speaker}
        date={message.date}
        outlineLines={message.outlineLines}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors from this file (the `NotesClient` call site now satisfies the full props interface).

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/notes/page.tsx"
git commit -m "feat(notes): wire Today's Message page to messageId and NotesTabs"
```

---

### Task 6: `PastMessagesList` + `/notes/past` route

**Files:**
- Create: `components/notes/PastMessagesList.tsx`
- Create: `app/(tabs)/notes/past/page.tsx`

**Interfaces:**
- Consumes: `listSavedMessages`, `deleteNotes` from `lib/notesStorage` (Task 2); `NotesTabs` (Task 4); `getLatestMessage` from `lib/webflow` (Task 1, for `.id` only).
- Produces: navigates to `/notes/past/{messageId}` on row tap, consumed by Task 7's route.

`PastMessagesList` takes a `currentMessageId?: string` prop so today's message (once it has notes) doesn't also appear in the Past list. `past/page.tsx` fetches it server-side the same way `/notes/page.tsx` already does — this is a cheap, cached (`revalidate: 300`) call, not a new dependency.

- [ ] **Step 1: Create `PastMessagesList.tsx`**

Create `components/notes/PastMessagesList.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ChevronRight } from "lucide-react";
import { listSavedMessages, deleteNotes, type SavedMessageSummary } from "@/lib/notesStorage";

interface PastMessagesListProps {
  currentMessageId?: string;
}

export function PastMessagesList({ currentMessageId }: PastMessagesListProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<SavedMessageSummary[] | null>(null);

  useEffect(() => {
    setMessages(listSavedMessages(currentMessageId));
  }, [currentMessageId]);

  const handleDelete = (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    deleteNotes(messageId);
    setMessages((prev) => (prev ?? []).filter((m) => m.messageId !== messageId));
  };

  if (messages === null) return null;

  if (messages.length === 0) {
    return (
      <div className="px-8 py-24 text-center">
        <p className="text-[15px] font-semibold text-ink-900">No past notes yet</p>
        <p className="mt-2 text-[13px] text-ink-600">
          Notes you take will show up here after the message ends.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 space-y-2">
      {messages.map((m) => (
        <div
          key={m.messageId}
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/notes/past/${m.messageId}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              router.push(`/notes/past/${m.messageId}`);
            }
          }}
          className="flex cursor-pointer items-center justify-between rounded-2xl bg-white px-4 py-4"
        >
          <div>
            <p className="text-[15px] font-semibold text-ink-900">{m.title}</p>
            <p className="mt-1 text-[13px] text-ink-600">
              {m.speaker}
              {m.speaker && m.date && " · "}
              {m.date}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => handleDelete(e, m.messageId)}
              aria-label={`Delete notes for ${m.title}`}
              className="rounded-full p-2 text-ink-400 hover:bg-ink-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <ChevronRight className="h-4 w-4 text-ink-300" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the `/notes/past` route**

Create `app/(tabs)/notes/past/page.tsx`:

```tsx
import { NotesTabs } from "@/components/notes/NotesTabs";
import { PastMessagesList } from "@/components/notes/PastMessagesList";
import { getLatestMessage } from "@/lib/webflow";

export default async function PastMessagesPage() {
  const message = await getLatestMessage().catch(() => null);

  return (
    <div className="pb-8">
      <NotesTabs />
      <PastMessagesList currentMessageId={message?.id} />
    </div>
  );
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/notes/PastMessagesList.tsx "app/(tabs)/notes/past/page.tsx"
git commit -m "feat(notes): add Past Messages list route"
```

---

### Task 7: `/notes/past/[id]` route (view + edit one past sermon)

**Files:**
- Create: `app/(tabs)/notes/past/[id]/page.tsx`

**Interfaces:**
- Consumes: `getNotes` from `lib/notesStorage` (Task 2); `SermonHeader` with `eyebrow` (Task 4); `NotesClient` with `messageId`/`date` (Task 3).

- [ ] **Step 1: Create the route**

Create `app/(tabs)/notes/past/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SermonHeader } from "@/components/notes/SermonHeader";
import { NotesClient } from "@/components/notes/NotesClient";
import { getNotes, type SavedNotesRecord } from "@/lib/notesStorage";

export default function PastMessagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<SavedNotesRecord | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const messageId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!messageId) return;
    const found = getNotes(messageId);
    if (!found) {
      setNotFound(true);
      router.replace("/notes/past");
      return;
    }
    setRecord(found);
  }, [params.id, router]);

  if (notFound || !record) return null;

  return (
    <div className="pb-8">
      <Link
        href="/notes/past"
        className="mx-4 mt-4 inline-block text-[13px] font-semibold text-brand-500"
      >
        ← Past Messages
      </Link>
      <SermonHeader
        title={record.title}
        speaker={record.speaker}
        date={record.date}
        eyebrow="Past Message"
      />
      <NotesClient
        messageId={record.messageId}
        sermonTitle={record.title}
        speaker={record.speaker}
        date={record.date}
        outlineLines={record.outlineLines}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project — this is the last call site for `NotesClient`, `SermonHeader`, and `notesStorage`, so a clean type check here confirms every interface across all tasks lines up.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/notes/past/[id]/page.tsx"
git commit -m "feat(notes): add past message detail route"
```

---

### Task 8: End-to-end verification and docs wrap-up

**Files:**
- Modify: `docs/Development/sermon-notes.md` (append session entry)

No new code in this task — this is manual verification per CLAUDE.md's UI-change requirement ("start the dev server and use the feature in a browser before reporting the task as complete") plus the project's session-logging workflow.

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all green.

- [ ] **Step 2: Manual smoke test in the browser**

Start the dev server (`npm run dev`) and, on `/notes`:

1. Add a chunk note and a freeform note. Reload the tab — notes persist (sessionStorage baseline still works).
2. Fully quit and reopen the browser (or open dev tools → Application → clear only sessionStorage, not localStorage, to simulate a browser close). Reload `/notes` — notes are still there. This is the core bug fix; confirm it explicitly.
3. Click the "Past Messages" tab — since only today's message has notes so far, and today's message is excluded from its own past list, it should show the empty state ("No past notes yet").
4. To exercise the past-message flow without waiting a week: in dev tools, note the `sermon-notes:{id}` key currently in `localStorage`, copy its value, and save it under a different key `sermon-notes:test-past-id` with a different `messageId` field inside the JSON. Reload `/notes/past` — the fake past entry now appears with title/speaker/date.
5. Tap it — `/notes/past/test-past-id` renders the outline and notes exactly as saved, with a "Past Message" eyebrow instead of "Today's Message," and a working "← Past Messages" back link.
6. Edit the notes on that past entry — confirm the edit persists (reload the page).
7. Go back to the Past Messages list and delete that test entry via the trash icon — confirm it disappears from the list and `localStorage` no longer has that key.
8. Clear all notes on today's message back to empty (delete the chunk note, clear the freeform textarea) — confirm (via dev tools) that the `sermon-notes:{today's id}` key is removed, not left behind empty.

- [ ] **Step 3: Append a session entry to the Development doc**

In `docs/Development/sermon-notes.md`, add a new entry at the top of "Recent Sessions" (above Session 12) following the existing format, describing: switch from `sessionStorage` to per-message `localStorage`, new `lib/notesStorage.ts` module, new `NotesTabs`/`PastMessagesList` components, new `/notes/past` and `/notes/past/[id]` routes, and the `AppMessage.id` addition. Also update the file's Key Files table to include the three new files. If the "Recent Sessions" list now exceeds 5 entries, move the oldest (currently Session 08) to `docs/Archive/sessions/session-008.md` per the CLAUDE.md rolling-history rule.

- [ ] **Step 4: Commit and push**

```bash
git add docs/Development/sermon-notes.md
git commit -m "docs(sermon-notes): log notes-history session"
git push
```
