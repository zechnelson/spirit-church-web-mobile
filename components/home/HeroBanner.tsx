import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

interface HeroBannerProps {
  text: string;
  href: string;
  handle?: string;
}

export function HeroBanner({ text, href, handle = "@spiritchurch.co" }: HeroBannerProps) {
  return (
    <div className="px-4">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block h-52 w-full overflow-hidden rounded-2xl"
      >
        {/* Background photo */}
        <Image
          src="/images/header-card-bg.png"
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 512px) 100vw, 512px"
          priority
        />

        {/* Dark gradient overlay so text is always readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {/* External link icon */}
        <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <ArrowUpRight size={16} className="text-white" strokeWidth={2} />
        </div>

        {/* Handle + text stacked so they never overlap */}
        <div className="absolute bottom-4 left-4 right-12 flex flex-col gap-1">
          <span className="text-[11px] font-medium text-white/60">{handle}</span>
          <p className="text-xl font-bold leading-tight text-white">{text}</p>
        </div>
      </a>
    </div>
  );
}
