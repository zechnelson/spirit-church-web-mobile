interface SermonHeaderProps {
  title: string;
  speaker: string;
  date: string;
  scripture?: string;
  eyebrow?: string;
}

export function SermonHeader({
  title,
  speaker,
  date,
  scripture,
  eyebrow = "Today's Message",
}: SermonHeaderProps) {
  return (
    <div className="px-4 pb-5 pt-6">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-brand-500">
        {eyebrow}
      </p>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink-900">
        {title}
      </h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {speaker && <span className="text-[13px] text-ink-600">{speaker}</span>}
        {speaker && date && <span className="text-ink-300">·</span>}
        {date && <span className="text-[13px] text-ink-600">{date}</span>}
      </div>
      {scripture && (
        <div className="mt-3 inline-flex items-center rounded-full bg-brand-50 px-3 py-1">
          <span className="text-[12px] font-medium text-brand-700">{scripture}</span>
        </div>
      )}
    </div>
  );
}
