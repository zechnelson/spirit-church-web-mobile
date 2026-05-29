"use client";

import { useEffect, useState } from "react";
import { HeroBanner } from "./HeroBanner";
import { getSundayHeroCard } from "@/lib/sunday-hero";

interface HeroCard {
  text: string;
  href: string;
  imageSrc?: string;
}

interface HeroBannerClientProps {
  fallback: HeroCard;
}

export function HeroBannerClient({ fallback }: HeroBannerClientProps) {
  const [card, setCard] = useState<HeroCard>(fallback);

  useEffect(() => {
    const sunday = getSundayHeroCard();
    setCard(sunday ?? fallback);
  }, [fallback]);

  return <HeroBanner text={card.text} href={card.href} imageSrc={card.imageSrc} />;
}
