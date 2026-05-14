"use client";

import { useRef } from "react";

interface SermonOutlineProps {
  lines: string[];
  onTextSelected?: (text: string) => void;
}

export function SermonOutline({ lines, onTextSelected }: SermonOutlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    // Only fire if the selection is within this container
    if (containerRef.current?.contains(selection.anchorNode)) {
      onTextSelected?.(text);
    }
  };

  return (
    <div className="mx-4 rounded-2xl bg-white px-5 py-5">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-ink-600">
        Sermon Notes
      </p>
      {/* select-text ensures text is selectable on all devices */}
      <div
        ref={containerRef}
        onPointerUp={handlePointerUp}
        className="select-text space-y-2"
      >
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
    </div>
  );
}
