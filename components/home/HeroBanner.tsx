"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight, X as CloseIcon } from "lucide-react";

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const XLogoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.741l7.73-8.835L1.254 2.25H8.08l4.261 5.638 5.903-5.638Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface HeroBannerProps {
  text: string;
  href: string;
  imageSrc?: string;
  handle?: string;
}

export function HeroBanner({
  text,
  href,
  imageSrc = "/images/header-card-bg.png",
  handle = "@spiritchurch.co",
}: HeroBannerProps) {
  const [shareOpen, setShareOpen] = useState(false);

  const encodedText = encodeURIComponent(text);
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?quote=${encodedText}&u=https%3A%2F%2Fwww.spiritchurch.co`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;

  return (
    <div className="px-4">
      <div
        className="relative h-52 w-full overflow-hidden rounded-2xl"
        onClick={() => shareOpen && setShareOpen(false)}
      >
        {/* Background photo */}
        <Image
          src={imageSrc || "/images/header-card-bg.png"}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 512px) 100vw, 512px"
          priority
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {/* Full-card link — removed when share panel is open */}
        {!shareOpen && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-10"
          />
        )}

        {/* Top-right: arrow button + slide-in share icons */}
        <div className="absolute right-3 top-3 z-20 flex items-center">
          {/* Share icons — slide in to the left of the button */}
          <div
            className={`flex items-center gap-1.5 overflow-hidden transition-all duration-250 ease-out ${
              shareOpen ? "max-w-[92px] pr-1.5 opacity-100" : "max-w-0 pr-0 opacity-0"
            }`}
          >
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm active:opacity-70"
            >
              <FacebookIcon />
            </a>
            <a
              href={xUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm active:opacity-70"
            >
              <XLogoIcon />
            </a>
          </div>

          {/* Arrow / close toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShareOpen((prev) => !prev);
            }}
            className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm active:opacity-70"
          >
            <ArrowUpRight
              size={16}
              strokeWidth={2}
              className={`absolute transition-all duration-200 ${
                shareOpen ? "scale-50 opacity-0" : "scale-100 opacity-100"
              }`}
            />
            <CloseIcon
              size={14}
              strokeWidth={2.5}
              className={`absolute transition-all duration-200 ${
                shareOpen ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
            />
          </button>
        </div>

        {/* Handle + text */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-12 z-10 flex flex-col gap-1">
          <span className="text-[11px] font-medium text-white/60">{handle}</span>
          <p className="text-xl font-bold leading-tight text-white">{text}</p>
        </div>
      </div>
    </div>
  );
}
