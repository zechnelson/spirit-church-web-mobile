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
