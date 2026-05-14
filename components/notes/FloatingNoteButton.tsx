"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";

interface FloatingNoteButtonProps {
  onAddNote: (text: string) => void;
  selectedText?: string;
  onClearSelection?: () => void;
}

export function FloatingNoteButton({
  onAddNote,
  selectedText = "",
  onClearSelection,
}: FloatingNoteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-open when the user selects text in the outline
  useEffect(() => {
    if (selectedText) setIsOpen(true);
  }, [selectedText]);

  // Focus textarea after sheet finishes sliding up
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => textareaRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Prefix with the quoted selection if one exists
    const note = selectedText
      ? `"${selectedText}"\n${trimmed}`
      : trimmed;

    onAddNote(note);
    setText("");
    handleClose();
  };

  const handleClose = () => {
    setText("");
    setIsOpen(false);
    onClearSelection?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
    if (e.key === "Escape") handleClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={handleClose}
        />
      )}

      {/* Slide-up sheet */}
      <div
        className="fixed left-0 right-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-white px-4 pb-4 pt-5 shadow-2xl transition-transform duration-300 ease-out"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 64px)",
          transform: isOpen ? "translateY(0)" : "translateY(110%)",
        }}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-300" />

        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink-900">Quick note</p>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-200 text-ink-600 active:opacity-70"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Selected text quote — shown when user highlighted something */}
        {selectedText && (
          <div className="mb-3 rounded-xl border-l-2 border-brand-400 bg-brand-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 mb-1">
              From message
            </p>
            <p className="line-clamp-3 text-[13px] italic leading-relaxed text-ink-800">
              &ldquo;{selectedText}&rdquo;
            </p>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedText ? "Add your thought…" : "Type a thought…"}
          rows={3}
          className="w-full resize-none rounded-xl border border-ink-300 bg-ink-200 px-4 py-3 text-[14px] leading-relaxed text-ink-900 placeholder:text-ink-600 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
        />

        <button
          onClick={handleAdd}
          disabled={text.trim().length === 0}
          className="mt-3 flex w-full items-center justify-center rounded-xl bg-brand-600 py-3 text-[14px] font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
        >
          Add Note
        </button>
      </div>

      {/* FAB */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Add a quick note"
        className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 shadow-lg transition-transform active:scale-95"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 80px)",
          right: "1rem",
        }}
      >
        <Plus size={26} strokeWidth={2.5} className="text-white" />
      </button>
    </>
  );
}
