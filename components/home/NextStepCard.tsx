import { ArrowUpRight } from "lucide-react";

interface NextStepCardProps {
  title: string;
  href: string;
  color?: string;
}

export function NextStepCard({ title, href, color = "#304c3f" }: NextStepCardProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="relative flex h-28 w-40 flex-shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl p-3 active:opacity-80"
      style={{ backgroundColor: color }}
    >
      <ArrowUpRight
        size={18}
        strokeWidth={2}
        className="self-end text-white/70"
      />
      <p className="text-[14px] font-semibold leading-snug text-white">
        {title}
      </p>
    </a>
  );
}
