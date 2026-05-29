import { describe, it, expect } from "vitest";
import { getSundayHeroCard } from "../sunday-hero";

// All UTC times for Sunday June 7, 2026 (Arizona = UTC-7):
// 9:00 AM AZ  = 16:00 UTC
// 9:49 AM AZ  = 16:49 UTC  (connect window ends at 9:50)
// 9:50 AM AZ  = 16:50 UTC  (yes window starts)
// 10:09 AM AZ = 17:09 UTC  (yes window ends at 10:10)
// 10:10 AM AZ = 17:10 UTC  (gap between services)
// 10:45 AM AZ = 17:45 UTC  (second service starts)
// 11:34 AM AZ = 18:34 UTC  (connect window ends at 11:35)
// 11:35 AM AZ = 18:35 UTC  (yes window starts)
// 11:54 AM AZ = 18:54 UTC  (yes window ends at 11:55)
// 11:55 AM AZ = 18:55 UTC  (after second service)

describe("getSundayHeroCard", () => {
  describe("first service (9:00–10:10 AM AZ)", () => {
    it("returns connect card at service start (9:00 AM)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T16:00:00.000Z"))?.text).toBe(
        "Connect with us"
      );
    });

    it("returns connect card at 9:49 AM (one minute before yes window)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T16:49:00.000Z"))?.text).toBe(
        "Connect with us"
      );
    });

    it("returns yes card at 9:50 AM (last 20 min begin)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T16:50:00.000Z"))?.text).toBe(
        'I said "yes" to Jesus'
      );
    });

    it("returns yes card at 10:09 AM (one minute before service ends)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T17:09:00.000Z"))?.text).toBe(
        'I said "yes" to Jesus'
      );
    });

    it("returns null at 10:10 AM (service over, gap between services)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T17:10:00.000Z"))).toBeNull();
    });
  });

  describe("second service (10:45–11:55 AM AZ)", () => {
    it("returns connect card at second service start (10:45 AM)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T17:45:00.000Z"))?.text).toBe(
        "Connect with us"
      );
    });

    it("returns connect card at 11:34 AM (one minute before yes window)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T18:34:00.000Z"))?.text).toBe(
        "Connect with us"
      );
    });

    it("returns yes card at 11:35 AM (last 20 min begin)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T18:35:00.000Z"))?.text).toBe(
        'I said "yes" to Jesus'
      );
    });

    it("returns yes card at 11:54 AM (one minute before second service ends)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T18:54:00.000Z"))?.text).toBe(
        'I said "yes" to Jesus'
      );
    });

    it("returns null at 11:55 AM (after second service)", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T18:55:00.000Z"))).toBeNull();
    });
  });

  describe("non-Sunday", () => {
    it("returns null on Saturday (June 6, 2026 at 9:30 AM AZ)", () => {
      expect(getSundayHeroCard(new Date("2026-06-06T16:30:00.000Z"))).toBeNull();
    });

    it("returns null on Monday (June 8, 2026 at 9:30 AM AZ)", () => {
      expect(getSundayHeroCard(new Date("2026-06-08T16:30:00.000Z"))).toBeNull();
    });
  });

  describe("card hrefs", () => {
    it("connect card links to connection-card form", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T16:00:00.000Z"))?.href).toBe(
        "https://www.spiritchurch.co/connection-card"
      );
    });

    it("yes card links to salvation form", () => {
      expect(getSundayHeroCard(new Date("2026-06-07T16:50:00.000Z"))?.href).toBe(
        "https://www.spiritchurch.co/connect/salvation"
      );
    });
  });
});
