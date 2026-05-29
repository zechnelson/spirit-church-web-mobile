"use client";

import { useState } from "react";
import { SermonOutline } from "./SermonOutline";
import { NoteEditor } from "./NoteEditor";
import { FloatingNoteButton } from "./FloatingNoteButton";
import { MyNotesModal } from "./MyNotesModal";

interface NotesClientProps {
  sermonTitle: string;
  speaker: string;
  outlineLines: string[];
}

export function NotesClient({ sermonTitle, speaker, outlineLines }: NotesClientProps) {
  const [notes, setNotes] = useState("");
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);

  const appendNote = (text: string) => {
    setNotes((prev) => (prev.trim() ? `${prev}\n${text}` : text));
  };

  return (
    <>
      <SermonOutline lines={outlineLines} onSaveNote={appendNote} />
      <NoteEditor
        notes={notes}
        onNotesChange={setNotes}
        sermonTitle={sermonTitle}
        speaker={speaker}
        outlineLines={outlineLines}
      />
      <FloatingNoteButton
        onOpenNotesModal={() => setIsNotesModalOpen(true)}
      />
      <MyNotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        notes={notes}
        onNotesChange={setNotes}
        sermonTitle={sermonTitle}
        speaker={speaker}
        outlineLines={outlineLines}
      />
    </>
  );
}
