import { describe, it, expect } from "vitest";
import {
  slugify,
  convertTo12Hour,
  calculateSpotsAvailable,
  parseMultiSelectAttribute,
  getImageUrl,
} from "../sync/utils";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Life Groups Downtown")).toBe("life-groups-downtown");
  });
  it("strips special characters", () => {
    expect(slugify("Men's Group")).toBe("mens-group");
  });
  it("collapses multiple hyphens", () => {
    expect(slugify("Group  --  Name")).toBe("group-name");
  });
  it("strips leading and trailing whitespace", () => {
    expect(slugify("  Test  ")).toBe("test");
  });
});

describe("convertTo12Hour", () => {
  it("converts 18:00:00 to 6:00 PM", () => {
    expect(convertTo12Hour("18:00:00")).toBe("6:00 PM");
  });
  it("converts 09:30:00 to 9:30 AM", () => {
    expect(convertTo12Hour("09:30:00")).toBe("9:30 AM");
  });
  it("converts 00:00:00 to 12:00 AM (midnight)", () => {
    expect(convertTo12Hour("00:00:00")).toBe("12:00 AM");
  });
  it("converts 12:00:00 to 12:00 PM (noon)", () => {
    expect(convertTo12Hour("12:00:00")).toBe("12:00 PM");
  });
  it("returns null for null input", () => {
    expect(convertTo12Hour(null)).toBeNull();
  });
});

describe("calculateSpotsAvailable", () => {
  it("returns capacity minus current members", () => {
    expect(calculateSpotsAvailable(20, 12)).toBe(8);
  });
  it("returns 0 when over capacity", () => {
    expect(calculateSpotsAvailable(10, 15)).toBe(0);
  });
  it("returns null when no capacity set", () => {
    expect(calculateSpotsAvailable(null, 5)).toBeNull();
  });
  it("treats null members as 0", () => {
    expect(calculateSpotsAvailable(10, null)).toBe(10);
  });
});

describe("parseMultiSelectAttribute", () => {
  it("splits ValueFormatted by comma", () => {
    expect(
      parseMultiSelectAttribute({ ValueFormatted: "Prayer, Bible Study" })
    ).toEqual(["Prayer", "Bible Study"]);
  });
  it("falls back to Value when no ValueFormatted", () => {
    expect(parseMultiSelectAttribute({ Value: "guid1,guid2" })).toEqual([
      "guid1",
      "guid2",
    ]);
  });
  it("returns empty array for undefined input", () => {
    expect(parseMultiSelectAttribute(undefined)).toEqual([]);
  });
  it("filters empty strings after split", () => {
    expect(
      parseMultiSelectAttribute({ ValueFormatted: "Prayer," })
    ).toEqual(["Prayer"]);
  });
});

describe("getImageUrl", () => {
  it("builds URL from GUID", () => {
    expect(
      getImageUrl({ Value: "abc-123" }, "https://rms.example.com/api")
    ).toBe("https://rms.example.com/GetImage.ashx?guid=abc-123");
  });
  it("strips /api suffix from base URL", () => {
    expect(
      getImageUrl({ Value: "abc-123" }, "https://rms.example.com/api")
    ).not.toContain("/api/GetImage");
  });
  it("returns null when Value is missing", () => {
    expect(getImageUrl({ Value: "" }, "https://rms.example.com/api")).toBeNull();
  });
  it("returns null for undefined input", () => {
    expect(getImageUrl(undefined, "https://rms.example.com/api")).toBeNull();
  });
});
