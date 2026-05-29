export interface SundayHeroCard {
  text: string;
  href: string;
  imageSrc: string;
}

const CONNECT_CARD: SundayHeroCard = {
  text: "Connect with us",
  href: "https://www.spiritchurch.co/connection-card",
  imageSrc: "/images/connect-card-bg.png",
};

const SALVATION_CARD: SundayHeroCard = {
  text: 'I said "yes" to Jesus',
  href: "https://www.spiritchurch.co/connect/salvation",
  imageSrc: "/images/salvation-card-bg.png",
};

// Minutes-since-midnight windows (Arizona time).
// Service 1: 9:00 AM (540) – 10:10 AM (610), yes starts at 9:50 AM (590)
// Service 2: 10:45 AM (645) – 11:55 AM (715), yes starts at 11:35 AM (695)
const WINDOWS = [
  { start: 540, end: 590, card: CONNECT_CARD },
  { start: 590, end: 610, card: SALVATION_CARD },
  { start: 645, end: 695, card: CONNECT_CARD },
  { start: 695, end: 715, card: SALVATION_CARD },
] as const;

export function getSundayHeroCard(now: Date = new Date()): SundayHeroCard | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value;
  if (weekday !== "Sun") return null;

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const minutes = hour * 60 + minute;

  for (const { start, end, card } of WINDOWS) {
    if (minutes >= start && minutes < end) return card;
  }

  return null;
}
