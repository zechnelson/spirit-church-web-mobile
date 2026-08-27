import { describe, it, expect } from "vitest";
import { getScheduledHeroCard, type ScheduledCard } from "../hero-schedule";

// All UTC times for Sunday June 7, 2026 (Arizona = UTC-7):
// 9:00 AM AZ  = 16:00 UTC
// 9:49 AM AZ  = 16:49 UTC
// 9:50 AM AZ  = 16:50 UTC
// 10:09 AM AZ = 17:09 UTC
// 10:10 AM AZ = 17:10 UTC
// 12:00 AM AZ (midnight) = 07:00 UTC same day

const CONNECT_CARD: ScheduledCard = {
  text: "Connect with us",
  href: "https://www.spiritchurch.co/connection-card",
  imageSrc: "/images/connect-card-bg.png",
  scheduleDay: "Sun",
  scheduleStartMinutes: 540, // 9:00 AM
  scheduleEndMinutes: 590, // 9:50 AM
};

const YES_CARD: ScheduledCard = {
  text: 'I said "yes" to Jesus',
  href: "https://www.spiritchurch.co/connect/salvation",
  imageSrc: "/images/salvation-card-bg.png",
  scheduleDay: "Sun",
  scheduleStartMinutes: 590, // 9:50 AM
  scheduleEndMinutes: 610, // 10:10 AM
};

const DEFAULT_CARD: ScheduledCard = {
  text: "Welcome to Spirit Church",
  href: "https://www.spiritchurch.co",
  imageSrc: "/images/header-card-bg.png",
  // no schedule fields — always-on CMS card
};

const MIDNIGHT_CARD: ScheduledCard = {
  text: "Midnight card",
  href: "https://www.spiritchurch.co/midnight",
  imageSrc: "/images/midnight-card-bg.png",
  scheduleDay: "Sun",
  scheduleStartMinutes: 0, // 12:00 AM
  scheduleEndMinutes: 30, // 12:30 AM
};

describe("getScheduledHeroCard", () => {
  const cards = [CONNECT_CARD, YES_CARD, DEFAULT_CARD];

  it("returns the matching scheduled card at window start (9:00 AM)", () => {
    expect(getScheduledHeroCard(cards, new Date("2026-06-07T16:00:00.000Z"))?.text).toBe(
      "Connect with us"
    );
  });

  it("returns the matching scheduled card one minute before the window ends (9:49 AM)", () => {
    expect(getScheduledHeroCard(cards, new Date("2026-06-07T16:49:00.000Z"))?.text).toBe(
      "Connect with us"
    );
  });

  it("switches to the next card exactly at its start boundary (9:50 AM)", () => {
    expect(getScheduledHeroCard(cards, new Date("2026-06-07T16:50:00.000Z"))?.text).toBe(
      'I said "yes" to Jesus'
    );
  });

  it("excludes the end boundary (10:10 AM is past the yes-card window)", () => {
    expect(getScheduledHeroCard(cards, new Date("2026-06-07T17:10:00.000Z"))).toBeNull();
  });

  it("returns null on a non-scheduled day (Saturday)", () => {
    expect(getScheduledHeroCard(cards, new Date("2026-06-06T16:30:00.000Z"))).toBeNull();
  });

  it("ignores cards with no schedule fields when matching", () => {
    // 2:00 PM Sunday — no scheduled card covers this, DEFAULT_CARD must not match
    expect(getScheduledHeroCard(cards, new Date("2026-06-07T21:00:00.000Z"))).toBeNull();
  });

  it("matches a card scheduled at midnight (00:00), proving hour parsing isn't off by 24", () => {
    expect(
      getScheduledHeroCard([MIDNIGHT_CARD], new Date("2026-06-07T07:00:00.000Z"))?.text
    ).toBe("Midnight card");
  });
});
