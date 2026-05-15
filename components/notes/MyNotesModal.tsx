"use client";

import { X } from "lucide-react";
import { NoteEditor } from "./NoteEditor";

interface MyNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: string;
  onNotesChange: (value: string) => void;
  sermonTitle: string;
  speaker: string;
  outlineLines: string[];
}

export function MyNotesModal({
  isOpen,
  onClose,
  notes,
  onNotesChange,
  sermonTitle,
  speaker,
  outlineLines,
}: MyNotesModalProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[59] bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* Half-screen sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[60] mx-auto flex max-w-lg flex-col rounded-t-2xl bg-background shadow-2xl transition-transform duration-300 ease-out will-change-transform"
        style={{
          height: "55vh",
          transform: isOpen ? "translateY(0)" : "translateY(110%)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-2 mt-3 h-1 w-10 flex-shrink-0 rounded-full bg-ink-300" />

        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-300 px-4 pb-3">
          <p className="text-[15px] font-semibold text-ink-900">My Notes</p>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-200 text-ink-600 active:opacity-70"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <NoteEditor
            notes={notes}
            onNotesChange={onNotesChange}
            sermonTitle={sermonTitle}
            speaker={speaker}
            outlineLines={outlineLines}
          />
        </div>
      </div>
    </>
  );
}
