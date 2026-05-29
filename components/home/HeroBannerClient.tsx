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
  const [isSundayCard, setIsSundayCard] = useState(false);

  useEffect(() => {
    const sunday = getSundayHeroCard();
    if (sunday) {
      setCard(sunday);
      setIsSundayCard(true);
    } else {
      setCard(fallback);
      setIsSundayCard(false);
    }
  }, [fallback]);

  return (
    <HeroBanner
      text={card.text}
      href={card.href}
      imageSrc={card.imageSrc}
      directLinkButton={isSundayCard}
    />
  );
}
