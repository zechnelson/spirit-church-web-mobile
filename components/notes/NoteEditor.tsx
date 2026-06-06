"use client";

import { useState, useEffect, useCallback } from "react";
import { Share2, Copy, Check, Mail } from "lucide-react";

interface NoteEditorProps {
  notes: string;
  onNotesChange: (value: string) => void;
  sermonTitle: string;
  speaker: string;
  outlineChunks: string[][];
  chunkNotes: string[];
}

export function NoteEditor({
  notes,
  onNotesChange,
  sermonTitle,
  speaker,
  outlineChunks,
  chunkNotes,
}: NoteEditorProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [includeSermon, setIncludeSermon] = useState(false);

  useEffect(() => {
    setCanShare(!!navigator.share);
  }, []);

  const hasNotes =
    notes.trim().length > 0 || chunkNotes.some((n) => n?.trim());

  const interleavedOutline = outlineChunks
    .map((chunk, i) => {
      const chunkText = chunk.filter(Boolean).join("\n");
      const note = chunkNotes[i]?.trim();
      return note ? `${chunkText}\n\n> ${note}` : chunkText;
    })
    .join("\n\n");

  const allNotesText = [
    ...chunkNotes.filter((n) => n?.trim()),
    notes.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const shareText = [
    `${sermonTitle} — ${speaker}`,
    "",
    ...(includeSermon ? ["── Message Notes ──", interleavedOutline, ""] : []),
    ...(includeSermon
      ? notes.trim() ? ["── Freeform Notes ──", notes] : []
      : allNotesText ? ["── Freeform Notes ──", allNotesText] : []),
  ].join("\n");

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareText]);

  const handleShare = useCallback(async () => {
    if (canShare) {
      try {
        await navigator.share({ title: sermonTitle, text: shareText });
      } catch {
        // User cancelled — do nothing
      }
      return;
    }
    // Desktop fallback: open email client pre-populated with notes
    const subject = encodeURIComponent(`${sermonTitle} — My Notes`);
    const body = encodeURIComponent(shareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [canShare, sermonTitle, shareText]);

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white px-5 py-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ink-600">
        Additional Notes
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

      <div className="mt-3 flex flex-col gap-2">
        <button
          onClick={handleCopy}
          disabled={!hasNotes}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ink-300 bg-white px-4 py-3 text-[14px] font-semibold text-ink-900 transition-opacity active:opacity-70 disabled:opacity-40"
        >
          {copied ? (
            <>
              <Check size={16} strokeWidth={2.5} className="text-brand-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy size={16} strokeWidth={2} />
              Copy
            </>
          )}
        </button>

        <button
          onClick={handleShare}
          disabled={!hasNotes}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-[14px] font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
        >
          {canShare ? (
            <Share2 size={16} strokeWidth={2} />
          ) : (
            <Mail size={16} strokeWidth={2} />
          )}
          Share
        </button>
      </div>
    </div>
  );
}
