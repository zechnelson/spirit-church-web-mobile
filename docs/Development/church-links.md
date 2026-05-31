# Church Links — Development

## Overview

Home page sections that surface church connection points: the "Your Next Step" cards carousel and (planned) other link/resource sections.

## Key Files

| File | Purpose |
| ---- | ------- |
| `app/(tabs)/page.tsx` | Home page — fetches all CMS data in parallel, renders carousels |
| `lib/webflow.ts` → `getNextSteps()` | Fetches Next Steps collection, sorts by `sort-order` |
| `lib/sunday-hero.ts` | Pure utility — returns time-gated hero card config or null based on Arizona service windows |
| `lib/__tests__/sunday-hero.test.ts` | 14 unit tests covering all service window boundaries |
| `components/home/HeroBanner.tsx` | Hero image card — supports share sheet (CMS card) or direct link button (Sunday cards) |
| `components/home/HeroBannerClient.tsx` | Client wrapper — checks time on mount, picks Sunday card or CMS fallback |
| `components/home/NextStepCard.tsx` | Individual card — colored background, title, external link arrow |
| `components/home/CarouselSection.tsx` | Horizontal scroll carousel wrapper used by all home sections |

## Webflow CMS

### Next Steps Collection (`6a06a5f50e11665321904497`)

| Field | Type | Notes |
| ----- | ---- | ----- |
| `name` | PlainText | Card label displayed to user |
| `link` | Link | External URL the card navigates to |
| `sort-order` | Number (integer) | Controls display order — lower = first |

- Items must be **published** to appear (drafts are filtered out)
- Sort is ascending by `sort-order` integer
- No color field — colors are assigned by the app (see below)

## Color Palette

Cards cycle through these 4 colors by index (repeats for 5+ items):

| Index | Color | Token |
| ----- | ----- | ----- |
| 0 | `#21332b` | brand-900 |
| 1 | `#4c725e` | brand-500 |
| 2 | `#84aa98` | brand-350 |
| 3 | `#c6c5ab` | warm-300 |

## Hero Banner — Time-Gated Cards

The hero banner at the top of the home page shows different cards depending on the time of day on Sundays.

### Service Windows (Arizona time, UTC-7, no DST)

| Window | Card |
|---|---|
| Sun 9:00–9:50 AM | "Connect with us" → `spiritchurch.co/connection-card` |
| Sun 9:50–10:10 AM | "I said yes to Jesus" → `spiritchurch.co/connect/salvation` |
| Sun 10:45–11:35 AM | "Connect with us" → `spiritchurch.co/connection-card` |
| Sun 11:35–11:55 AM | "I said yes to Jesus" → `spiritchurch.co/connect/salvation` |
| All other times | CMS shareable quote (from Webflow `getHeaderCards()`) |

### How It Works

- `getSundayHeroCard(now?)` in `lib/sunday-hero.ts` is a pure function — pass a `Date` to test, or call with no args for the real clock.
- `HeroBannerClient` is a `"use client"` wrapper that initializes with the server-fetched CMS card (avoids hydration mismatch), then swaps to a Sunday card on mount via `useEffect`.
- Sunday cards use `directLinkButton` prop on `HeroBanner` — replaces the share sheet with a plain arrow link to the card URL.
- Card images: `/images/connect-card-bg.png` and `/images/salvation-card-bg.png`.

### Testing Time Windows

Temporarily hardcode a date in `HeroBannerClient.tsx` to verify a specific window:
```tsx
const sunday = getSundayHeroCard(new Date("2026-06-07T16:00:00.000Z")); // 9:00 AM AZ — connect
const sunday = getSundayHeroCard(new Date("2026-06-07T16:50:00.000Z")); // 9:50 AM AZ — yes to Jesus
```
Run `npm test` to verify all 14 unit tests pass.

## Recent Sessions

### Session 05 (2026-05-31) — GroupCard layout redesign

**Goal:** Change GroupCard to match EventCard layout; show name, location, and meeting schedule.

**Solution:**
- `getGroups()` now fetches the Cities collection in parallel and resolves the `city` Ref field to a name string — no new Webflow field needed, no sync changes
- Updated `AppGroup` interface: removed `category`, added `location?` and `schedule?`
- `location` resolved by looking up `item.fieldData["city"]` ID in the cities map; `schedule` reads the existing `schedule-description` PlainText field
- Rewrote `GroupCard` to top-image + stacked-text layout matching `EventCard`

**Files Modified:**
- `lib/webflow.ts` — updated `AppGroup`; updated `getGroups()` to resolve city Ref via parallel Cities fetch
- `components/home/GroupCard.tsx` — full layout rewrite

**Status:** VERIFIED WORKING

---

### Session 04 (2026-05-30) — Group images in home carousel

**Goal:** Show real group images in the "Join a group" carousel instead of a placeholder.

**Solution:** Added `imageSrc?: string` to the `AppGroup` interface and mapped `item.fieldData["group-image"]` as `WfImage` in `getGroups()`. `GroupCard` already accepted `imageSrc?` with a placeholder fallback — no component changes needed. `page.tsx` already spreads `{...group}` onto `GroupCard` — no page changes needed.

**Files Modified:**
- `lib/webflow.ts` — added `imageSrc` to `AppGroup`; mapped `group-image` in `getGroups()`

**Status:** VERIFIED WORKING (requires sync to have run since `group-image` field was added)

---

### Session 01 (2026-05-15) — Next Steps CMS connection

**Goal:** Replace hardcoded Next Steps cards with Webflow CMS-managed items.

**Solution:**
- Created "Next Steps" collection in Webflow with `Name`, `Link`, and `Sort Order` (integer) fields
- Added `getNextSteps()` to `lib/webflow.ts` — fetches, filters drafts/archived, sorts by `sort-order`
- Updated `page.tsx` to fetch next steps in parallel with other CMS calls
- Color palette set to brand-900, brand-500, brand-350, warm-300 cycling by index

**Files Modified:**
- `lib/webflow.ts` — added `nextSteps` collection ID, `AppNextStep` interface, `getNextSteps()`
- `app/(tabs)/page.tsx` — replaced hardcoded array with CMS fetch, updated color palette

**Status:** VERIFIED WORKING (4 items live in Webflow)

### Session 02 (2026-05-29) — HeroBanner share button UI polish

**Goal:** Improve the share button and social icons in the hero banner for better tap targets and visual consistency.

**Solution:**
- Grew share toggle button from `h-8 w-8` → `h-11 w-11`; icon from `size={16}` → `size={22}`
- Changed share button background from `bg-white/20 backdrop-blur-sm` to solid `bg-white` with `text-ink-800` icon
- Matched Facebook and X social buttons to same `h-11 w-11` solid white style; SVG icons bumped to `h-5 w-5`
- Widened slide-out container from `max-w-[92px]` → `max-w-[116px]` to fit larger buttons
- Bumped `@spiritchurch.co` handle opacity from `text-white/60` → `text-white/90` for legibility

**Files Modified:**
- `components/home/HeroBanner.tsx` — button sizes, background, icon sizes, handle opacity

**Status:** VERIFIED WORKING

### Session 03 (2026-05-29) — Time-gated hero banner

**Goal:** Show "Connect with us" and "I said yes to Jesus" cards during Sunday services instead of the CMS quote card.

**Solution:**
- Added `getSundayHeroCard()` pure utility in `lib/sunday-hero.ts` — reads Arizona time via `Intl.DateTimeFormat`, returns card config or null based on service windows
- Created `HeroBannerClient` client wrapper — initializes from CMS fallback (server-safe), swaps to Sunday card in `useEffect` on mount
- Added `directLinkButton` prop to `HeroBanner` — when true, replaces social share sheet with a plain arrow link to the card's href
- Set up Vitest with 14 unit tests covering all window boundaries and edge cases

**Files Modified:**
- `lib/sunday-hero.ts` — new: time utility
- `lib/__tests__/sunday-hero.test.ts` — new: 14 unit tests
- `vitest.config.ts` — new: Vitest config (node env)
- `package.json` — added vitest dev dependency and test script
- `components/home/HeroBannerClient.tsx` — new: client wrapper
- `components/home/HeroBanner.tsx` — added `directLinkButton` prop
- `app/(tabs)/page.tsx` — swapped `<HeroBanner>` for `<HeroBannerClient>`

**Status:** VERIFIED WORKING (browser-tested all three card states, 14/14 tests pass)
