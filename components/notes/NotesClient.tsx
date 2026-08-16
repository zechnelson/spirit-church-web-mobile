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
