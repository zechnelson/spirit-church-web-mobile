import { ArrowRight } from "lucide-react";

interface CarouselSectionProps {
  title: string;
  href?: string;
  children: React.ReactNode;
}

export function CarouselSection({ title, href = "#", children }: CarouselSectionProps) {
  return (
    <section className="mt-7">
      {/* Section header — px-4 sets the baseline alignment */}
      <div className="mb-3 flex items-center justify-between px-4">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        <a
          href={href}
          className="flex items-center gap-0.5 text-[13px] font-medium text-ink-600 active:opacity-70"
        >
          <ArrowRight size={15} strokeWidth={2} />
        </a>
      </div>

      {/* Scroll container — px-4 aligns first card with section header above */}
      <div className="flex items-stretch gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
        {/* Spacer so the last card doesn't sit flush against the scroll boundary */}
        <div className="w-4 flex-shrink-0" />
      </div>
    </section>
  );
}
