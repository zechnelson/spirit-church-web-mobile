# Time-Gated Hero Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show contextual hero cards on the home page during Sunday services, falling back to the CMS card the rest of the week.

**Architecture:** A pure utility `getSundayHeroCard()` computes which card to show based on Arizona time. A thin client wrapper `HeroBannerClient` calls it on mount and passes the result (or the server-fetched CMS fallback) into the existing `HeroBanner`. `page.tsx` is unchanged except swapping `<HeroBanner>` for `<HeroBannerClient>`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest (unit tests), `Intl.DateTimeFormat` (timezone handling)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/sunday-hero.ts` | Time logic — returns correct card or null |
| Create | `lib/__tests__/sunday-hero.test.ts` | Unit tests for time windows |
| Create | `vitest.config.ts` | Vitest config (node env, no Next.js transform) |
| Create | `components/home/HeroBannerClient.tsx` | Client wrapper — mounts, checks time, renders HeroBanner |
| Modify | `app/(tabs)/page.tsx` | Swap `<HeroBanner>` for `<HeroBannerClient fallback={...}>` |

---

## Task 1: Install Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

Expected output ends with: `added N packages`

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts` at the project root:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add `"test": "vitest run"` to the `scripts` block:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run"
},
```

- [ ] **Step 4: Verify vitest runs**

```bash
npm test
```

Expected: `No test files found, exiting with code 0` (or similar — no error about missing config)

---

## Task 2: Write failing tests for `getSundayHeroCard`

**Files:**
- Create: `lib/__tests__/sunday-hero.test.ts`

June 7, 2026 is a Sunday. Arizona is UTC-7 with no DST (`America/Phoenix`).

- [ ] **Step 1: Create the test file**

Create `lib/__tests__/sunday-hero.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — confirm they all fail**

```bash
npm test
```

Expected: all tests FAIL with `Cannot find module '../sunday-hero'`

---

## Task 3: Implement `getSundayHeroCard`

**Files:**
- Create: `lib/sunday-hero.ts`

- [ ] **Step 1: Create the utility**

Create `lib/sunday-hero.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — confirm they all pass**

```bash
npm test
```

Expected: `13 tests passed`

- [ ] **Step 3: Commit**

```bash
git add lib/sunday-hero.ts lib/__tests__/sunday-hero.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: getSundayHeroCard utility with time-window tests"
```

---

## Task 4: Create `HeroBannerClient`

**Files:**
- Create: `components/home/HeroBannerClient.tsx`

- [ ] **Step 1: Create the client wrapper**

Create `components/home/HeroBannerClient.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/home/HeroBannerClient.tsx
git commit -m "feat: HeroBannerClient — client-side Sunday time gate"
```

---

## Task 5: Wire into `page.tsx`

**Files:**
- Modify: `app/(tabs)/page.tsx`

- [ ] **Step 1: Swap `HeroBanner` for `HeroBannerClient`**

In `app/(tabs)/page.tsx`, replace the `HeroBanner` import and the hero render block.

Change the import line:
```tsx
// Before
import { HeroBanner } from "@/components/home/HeroBanner";

// After
import { HeroBannerClient } from "@/components/home/HeroBannerClient";
```

Replace the hero render block (lines 31–35):
```tsx
// Before
{hero ? (
  <HeroBanner text={hero.text} href={hero.href} imageSrc={hero.imageSrc} />
) : (
  <HeroBanner text="Welcome to Spirit Church" href="#" />
)}

// After
<HeroBannerClient
  fallback={hero ?? { text: "Welcome to Spirit Church", href: "#" }}
/>
```

- [ ] **Step 2: Verify in the browser**

Open `http://localhost:3000`. The home page should load with the CMS hero card. No errors in the console.

To manually test the Sunday card logic without waiting for Sunday, temporarily call `getSundayHeroCard` with a hardcoded Sunday time in `HeroBannerClient.tsx`:

```tsx
// Temporary test — remove after verifying
const sunday = getSundayHeroCard(new Date("2026-06-07T16:00:00.000Z"));
```

Confirm "Connect with us" appears as the hero. Then change the time to `"2026-06-07T16:50:00.000Z"` and confirm 'I said "yes" to Jesus' appears. Revert the temporary change.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/page.tsx
git commit -m "feat: wire time-gated hero banner into home page"
```
