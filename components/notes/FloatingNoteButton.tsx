"use client";

import { FileText } from "lucide-react";

interface FloatingNoteButtonProps {
  onOpenNotesModal?: () => void;
}

export function FloatingNoteButton({ onOpenNotesModal }: FloatingNoteButtonProps) {
  return (
    <button
      onClick={onOpenNotesModal}
      aria-label="View my notes"
      className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 shadow-lg transition-transform active:scale-95"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 80px)",
        right: "1rem",
      }}
    >
      <FileText size={22} strokeWidth={1.75} className="text-white" />
    </button>
  );
}
