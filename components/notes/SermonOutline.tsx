"use client";

import { InlineNoteChunk } from "./InlineNoteChunk";

interface SermonOutlineProps {
  chunks: string[][];
  chunkNotes: string[];
  onSaveNote: (text: string, chunkIndex: number) => void;
}

export function SermonOutline({ chunks, chunkNotes, onSaveNote }: SermonOutlineProps) {
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
              chunkIndex={i}
              savedNote={chunkNotes[i] ?? ""}
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
