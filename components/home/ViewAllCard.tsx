import { ArrowUpRight } from "lucide-react";

interface ViewAllCardProps {
  href: string;
  label?: string;
}

export function ViewAllCard({ href, label = "See all" }: ViewAllCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-24 flex-shrink-0 snap-start self-stretch flex-col items-center justify-center gap-2 rounded-xl border border-ink-300 bg-white text-center active:opacity-70"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-200">
        <ArrowUpRight size={15} className="text-ink-900" strokeWidth={2} />
      </div>
      <span className="text-[11px] font-semibold leading-tight text-ink-900">
        {label}
      </span>
    </a>
  );
}
