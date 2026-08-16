"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NotesTabs() {
  const pathname = usePathname();
  const isPast = pathname?.startsWith("/notes/past") ?? false;

  return (
    <div className="mx-4 mb-2 mt-4 flex gap-1 rounded-full bg-ink-50 p-1">
      <Link
        href="/notes"
        className={`flex-1 rounded-full py-2 text-center text-[13px] font-semibold transition-colors ${
          !isPast ? "bg-white text-ink-900 shadow-sm" : "text-ink-600"
        }`}
      >
        Today&apos;s Message
      </Link>
      <Link
        href="/notes/past"
        className={`flex-1 rounded-full py-2 text-center text-[13px] font-semibold transition-colors ${
          isPast ? "bg-white text-ink-900 shadow-sm" : "text-ink-600"
        }`}
      >
        Past Messages
      </Link>
    </div>
  );
}
