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
