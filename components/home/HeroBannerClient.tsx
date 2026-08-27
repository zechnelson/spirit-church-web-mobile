"use client";

import { useEffect, useState } from "react";
import { HeroBanner } from "./HeroBanner";
import { getScheduledHeroCard } from "@/lib/hero-schedule";
import type { AppSliderCard } from "@/lib/webflow";

interface HeroCard {
  text: string;
  href: string;
  imageSrc?: string;
}

interface HeroBannerClientProps {
  cards: AppSliderCard[];
  fallback: HeroCard;
}

export function HeroBannerClient({ cards, fallback }: HeroBannerClientProps) {
  const [card, setCard] = useState<HeroCard>(fallback);
  const [isScheduledCard, setIsScheduledCard] = useState(false);

  useEffect(() => {
    const scheduled = getScheduledHeroCard(cards);
    if (scheduled) {
      setCard(scheduled);
      setIsScheduledCard(true);
    } else {
      setCard(fallback);
      setIsScheduledCard(false);
    }
  }, [cards, fallback]);

  return (
    <HeroBanner
      text={card.text}
      href={card.href}
      imageSrc={card.imageSrc}
      directLinkButton={isScheduledCard}
    />
  );
}
