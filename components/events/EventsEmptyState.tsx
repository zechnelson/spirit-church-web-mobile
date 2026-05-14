import { CalendarDays } from "lucide-react";

export function EventsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        <CalendarDays size={28} className="text-brand-400" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-[17px] font-bold text-ink-900">
        Nothing scheduled yet
      </h2>
      <p className="mb-6 text-[13px] leading-relaxed text-ink-600">
        Check back soon — events will show up here as they&apos;re announced.
      </p>
      <a
        href="https://www.spiritchurch.co/events"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl border border-ink-300 bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-900 active:opacity-70"
      >
        Visit our website
      </a>
    </div>
  );
}
