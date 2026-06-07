"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SermonOutline } from "./SermonOutline";
import { NoteEditor } from "./NoteEditor";
import { FloatingNoteButton } from "./FloatingNoteButton";
import { MyNotesModal } from "./MyNotesModal";

interface NotesClientProps {
  sermonTitle: string;
  speaker: string;
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

export function NotesClient({ sermonTitle, speaker, outlineLines }: NotesClientProps) {
  const [freeNotes, setFreeNotes] = useState<string>("");
  const [chunkNotes, setChunkNotes] = useState<string[]>([]);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const pendingToastRef = useRef(false);

  useEffect(() => {
    setFreeNotes(sessionStorage.getItem("spirit-notes-free") ?? "");
    try {
      setChunkNotes(JSON.parse(sessionStorage.getItem("spirit-notes-chunks") ?? "[]"));
    } catch {
      // keep empty array
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem("spirit-notes-free", freeNotes);
  }, [freeNotes, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    sessionStorage.setItem("spirit-notes-chunks", JSON.stringify(chunkNotes));
    if (pendingToastRef.current) {
      pendingToastRef.current = false;
      toast.success("Added to session notes");
    }
  }, [chunkNotes, isHydrated]);

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
