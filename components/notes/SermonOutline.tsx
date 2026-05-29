"use client";

import { InlineNoteChunk } from "./InlineNoteChunk";

interface SermonOutlineProps {
  lines: string[];
  onSaveNote: (text: string) => void;
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

export function SermonOutline({ lines, onSaveNote }: SermonOutlineProps) {
  const chunks = chunkLines(lines);

  return (
    <div className="mx-4 rounded-2xl bg-white px-5 py-5">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-ink-600">
        Sermon Notes
      </p>
      <div className="space-y-0">
        {chunks.map((chunk, i) => (
          <div key={i}>
            <InlineNoteChunk
              lines={chunk}
              onSaveNote={onSaveNote}
            />
            {i < chunks.length - 1 && (
              <hr className="my-5 border-ink-100" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
