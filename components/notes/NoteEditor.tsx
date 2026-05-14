"use client";

import { useState, useEffect, useCallback } from "react";
import { Share2, Copy, Check } from "lucide-react";

interface NoteEditorProps {
  notes: string;
  onNotesChange: (value: string) => void;
  sermonTitle: string;
  speaker: string;
  outlineLines: string[];
}

export function NoteEditor({
  notes,
  onNotesChange,
  sermonTitle,
  speaker,
  outlineLines,
}: NoteEditorProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [includeSermon, setIncludeSermon] = useState(false);

  useEffect(() => {
    setCanShare(!!navigator.share);
  }, []);

  const sermonText = outlineLines.filter(Boolean).join("\n");

  const shareText = [
    `${sermonTitle} — ${speaker}`,
    "",
    ...(includeSermon ? ["── Message Notes ──", sermonText, ""] : []),
    "── My Notes ──",
    notes,
  ].join("\n");

  const handleShare = useCallback(async () => {
    if (canShare) {
      try {
        await navigator.share({ title: sermonTitle, text: shareText });
      } catch {
        // User cancelled — do nothing
      }
      return;
    }

    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [canShare, sermonTitle, shareText]);

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white px-5 py-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ink-600">
        My Notes
      </p>

      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Start typing your notes…"
        rows={8}
        className="w-full resize-none rounded-xl border border-ink-300 bg-ink-200 px-4 py-3 text-[14px] leading-relaxed text-ink-900 placeholder:text-ink-600 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
      />

      {/* Include sermon toggle */}
      <label className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-ink-300 px-4 py-3">
        <span className="text-[13px] text-ink-800">Include full message notes</span>
        <div className="relative">
          <input
            type="checkbox"
            checked={includeSermon}
            onChange={(e) => setIncludeSermon(e.target.checked)}
            className="sr-only"
          />
          <div
            className={`h-6 w-10 rounded-full transition-colors duration-200 ${
              includeSermon ? "bg-brand-600" : "bg-ink-300"
            }`}
          />
          <div
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
              includeSermon ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </div>
      </label>

      <button
        onClick={handleShare}
        disabled={notes.trim().length === 0}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-[14px] font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
      >
        {copied ? (
          <>
            <Check size={16} strokeWidth={2.5} />
            Copied!
          </>
        ) : canShare ? (
          <>
            <Share2 size={16} strokeWidth={2} />
            Share Notes
          </>
        ) : (
          <>
            <Copy size={16} strokeWidth={2} />
            Copy Notes
          </>
        )}
      </button>

      <p className="mt-2 text-center text-[11px] text-ink-600">
        {canShare
          ? "Share via Messages, Mail, or any app"
          : "Copies title + your notes to clipboard"}
      </p>
    </div>
  );
}
