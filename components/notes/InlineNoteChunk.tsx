"use client";

import { useRef, useState } from "react";
import { PlusCircle } from "lucide-react";

interface InlineNoteChunkProps {
  lines: string[];
  chunkIndex: number;
  onSaveNote: (text: string, chunkIndex: number) => void;
}

export function InlineNoteChunk({ lines, chunkIndex, onSaveNote }: InlineNoteChunkProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const discardRef = useRef(false);
  const lastSavedRef = useRef("");

  const handleToggle = () => {
    if (!isOpen) {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setIsOpen(false);
      setInputValue("");
      lastSavedRef.current = "";
    }
  };

const handleBlur = () => {
    if (discardRef.current) {
      discardRef.current = false;
      return;
    }
    const trimmed = inputValue.trim();
    if (!trimmed || trimmed === lastSavedRef.current) return;
    onSaveNote(trimmed, chunkIndex);
    lastSavedRef.current = trimmed;
  };

  return (
    <div>
      <div className="select-text space-y-2">
        {lines.map((line, i) => {
          if (line === "") return <div key={i} className="h-2" />;

          if (line.startsWith("“") || line.startsWith('"')) {
            return (
              <p key={i} className="border-l-2 border-brand-300 pl-3 text-[14px] italic leading-relaxed text-ink-600">
                {line}
              </p>
            );
          }

          if (line === line.toUpperCase() || line.endsWith(":")) {
            return (
              <p key={i} className="pt-1 text-[13px] font-bold text-ink-900">
                {line}
              </p>
            );
          }

          if (line.startsWith("•") || line.startsWith("-") || /^\d+\./.test(line)) {
            return (
              <p key={i} className="pl-3 text-[14px] leading-relaxed text-ink-800">
                {line}
              </p>
            );
          }

          return (
            <p key={i} className="text-[14px] leading-relaxed text-ink-800">
              {line}
            </p>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleToggle}
        onMouseDown={() => { discardRef.current = true; }}
        onTouchStart={() => { discardRef.current = true; }}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink-300 py-2.5 text-[13px] font-semibold text-ink-700 transition-opacity active:opacity-60"
      >
        <PlusCircle
          size={15}
          strokeWidth={1.75}
          className={`transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`}
        />
        {isOpen ? "Remove Note" : "Add Notes"}
      </button>

      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          isOpen ? "max-h-48" : "max-h-0"
        }`}
      >
        <textarea
          ref={inputRef}
          rows={4}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="Type a note…"
          className="mt-2 w-full resize-none rounded-xl border border-ink-300 bg-ink-200 px-4 py-3 text-[14px] leading-relaxed text-ink-900 placeholder:text-ink-500 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
        />
      </div>
    </div>
  );
}
