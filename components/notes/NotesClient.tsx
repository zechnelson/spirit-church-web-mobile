"use client";

import { useState } from "react";
import { SermonOutline } from "./SermonOutline";
import { NoteEditor } from "./NoteEditor";
import { FloatingNoteButton } from "./FloatingNoteButton";

interface NotesClientProps {
  sermonTitle: string;
  speaker: string;
  outlineLines: string[];
}

export function NotesClient({ sermonTitle, speaker, outlineLines }: NotesClientProps) {
  const [notes, setNotes] = useState("");
  const [selectedText, setSelectedText] = useState("");

  const appendNote = (text: string) => {
    setNotes((prev) => (prev.trim() ? `${prev}\n${text}` : text));
  };

  const clearSelection = () => {
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  };

  return (
    <>
      <SermonOutline lines={outlineLines} onTextSelected={setSelectedText} />
      <NoteEditor
        notes={notes}
        onNotesChange={setNotes}
        sermonTitle={sermonTitle}
        speaker={speaker}
        outlineLines={outlineLines}
      />
      <FloatingNoteButton
        onAddNote={appendNote}
        selectedText={selectedText}
        onClearSelection={clearSelection}
      />
    </>
  );
}
