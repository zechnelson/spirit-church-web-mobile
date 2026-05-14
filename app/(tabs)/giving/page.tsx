"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

const GIVING_URL = "https://donate.overflow.co/spiritchurch/cash";

export default function GivingPage() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      className="relative w-full"
      style={{ height: "calc(100dvh - env(safe-area-inset-bottom) - 64px)" }}
    >
      {/* Loading state */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-warm-50">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-300 border-t-brand-500" />
          <p className="text-[13px] text-ink-600">Loading giving form…</p>
        </div>
      )}

      {/* Embed */}
      {!error && (
        <iframe
          src={GIVING_URL}
          title="Give to Spirit Church"
          className="h-full w-full border-0"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          allow="payment"
        />
      )}

      {/* Fallback if iframe is blocked */}
      {error && (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-[15px] font-semibold text-ink-900">
            Unable to load the giving form here.
          </p>
          <p className="text-[13px] text-ink-600">
            Tap below to give securely in your browser.
          </p>
          <a
            href={GIVING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-[14px] font-semibold text-white active:opacity-80"
          >
            <ExternalLink size={16} strokeWidth={2} />
            Open Giving Page
          </a>
        </div>
      )}
    </div>
  );
}
