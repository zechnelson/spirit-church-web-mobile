export interface ScheduledCard {
  text: string;
  href: string;
  imageSrc: string;
  scheduleDay?: string;
  scheduleStartMinutes?: number;
  scheduleEndMinutes?: number;
}

export function getScheduledHeroCard<T extends ScheduledCard>(
  cards: T[],
  now: Date = new Date()
): T | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Phoenix",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const minutes = hour * 60 + minute;

  return (
    cards.find(
      (card) =>
        card.scheduleDay === weekday &&
        card.scheduleStartMinutes !== undefined &&
        card.scheduleEndMinutes !== undefined &&
        minutes >= card.scheduleStartMinutes &&
        minutes < card.scheduleEndMinutes
    ) ?? null
  );
}
