# Church Links — Development

## Overview

Home page sections that surface church connection points: the "Your Next Step" cards carousel and (planned) other link/resource sections.

## Key Files

| File | Purpose |
| ---- | ------- |
| `app/(tabs)/page.tsx` | Home page — fetches all CMS data in parallel, renders carousels |
| `lib/webflow.ts` → `getNextSteps()` | Fetches Next Steps collection, sorts by `sort-order` |
| `lib/hero-schedule.ts` | Pure utility — returns the CMS card matching the current day/time, or null |
| `lib/__tests__/hero-schedule.test.ts` | Unit tests covering window boundaries, non-matching days, and the midnight edge case |
| `components/home/HeroBanner.tsx` | Hero image card — supports share sheet (default CMS card) or direct link button (scheduled cards) |
| `components/home/HeroBannerClient.tsx` | Client wrapper — checks time on mount, picks the matching scheduled card or the default CMS fallback |
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

## Hero Banner — CMS-Scheduled Cards

The hero banner at the top of the home page shows different cards depending on the time of day, fully controlled by the client through the `headerCards` Webflow collection — no code changes needed to adjust service times or card content/images.

### Schedule Fields (on `headerCards`, id `6a068822d95ce2e41e516c89`)

| Field slug | Type | Notes |
|---|---|---|
| `schedule-day` | Option | `Sunday`–`Saturday`. **Empty = always-on default card** (share-sheet CMS card, same as before). |
| `schedule-start-hour` / `schedule-end-hour` | Option | 24 options, `12 AM`–`11 PM` (internally 24-hour `0`–`23`). |
| `schedule-start-minute` / `schedule-end-minute` | Option | 12 options, `:00`–`:55` in 5-minute steps. |

One collection item = one card + one time window (Webflow has no repeating field groups, so recurring services like the two Sunday windows each need 2 items — e.g. "Connect with us (early)" and "I said yes (early)", then again for the late service). Existing fields (`name`, `card-text`, `background-image`, `card-link`) are reused unchanged for scheduled cards — the client uploads their own images per card now instead of the old static `/public/images/connect-card-bg.png` / `salvation-card-bg.png` files.

**Webflow Option field gotcha:** the API stores the option's *generated* id in `fieldData`, not its display label. `lib/webflow.ts` hardcodes id→value lookup tables (`SCHEDULE_DAY_OPTIONS`, `SCHEDULE_START_HOUR_OPTIONS`, etc.) to translate them. If a field's options are ever deleted/recreated in Webflow, these tables must be regenerated from the new ids.

### How It Works

- `getScheduledHeroCard(cards, now?)` in `lib/hero-schedule.ts` is a generic pure function — pass an array of cards (each with optional `scheduleDay`/`scheduleStartMinutes`/`scheduleEndMinutes`) and a `Date` to test, or call with no `now` for the real clock. Returns the first matching card or `null`.
- `getHeaderCards()` in `lib/webflow.ts` returns the **full** item list (not just item 0), with schedule fields parsed from Option ids into a weekday string + minutes-since-midnight.
- `HeroBannerClient` is a `"use client"` wrapper that receives the full `cards` list plus a `fallback` (the item with no `schedule-day`, chosen server-side in `page.tsx`). It initializes with `fallback` (avoids hydration mismatch), then on mount runs `getScheduledHeroCard` and swaps in a matching card if one applies.
- Scheduled cards use `directLinkButton` on `HeroBanner` — replaces the share sheet with a plain arrow link to the card's `card-link`.
- Uses `hourCycle: "h23"` (not just `hour12: false`) when reading the Phoenix time — `en-US` locale otherwise reports midnight as hour `24` instead of `00`, which would break any card scheduled starting at 12 AM.

### Testing Time Windows

`getScheduledHeroCard` takes `now` as a plain argument, so tests just pass fixed dates — see `lib/__tests__/hero-schedule.test.ts`. To manually verify a specific window against the real live CMS: create a temporary item in `headerCards` with a schedule window covering the current time, load the page, confirm the swap, then delete the item.

Run `npm test` to verify all unit tests pass.

## Recent Sessions

### Session 08 (2026-08-27) — CMS-controlled hero card scheduling

**Goal:** Give the client control over Sunday hero card content and timing through Webflow, instead of requiring a code change (`lib/sunday-hero.ts`'s hardcoded windows) whenever service times or card copy changed.

**Solution:**
- Added 5 Option fields to the live `headerCards` collection: `schedule-day` (7 options), `schedule-start-hour`/`schedule-end-hour` (24 options each, `12 AM`–`11 PM`), `schedule-start-minute`/`schedule-end-minute` (12 options each, 5-min steps). Chose Option (dropdown) fields over `PlainText` specifically to eliminate free-text format errors, and over `DateTime` because that type bundles a full calendar date the client would have to ignore for a recurring weekly window.
- `lib/webflow.ts` — `getHeaderCards()` now returns the full item list (was just item 0) with schedule fields parsed via hardcoded Option-id→value lookup tables (Webflow stores the option's generated id in `fieldData`, not its label).
- Replaced `lib/sunday-hero.ts` (hardcoded windows/cards) with generic `lib/hero-schedule.ts` → `getScheduledHeroCard(cards, now?)`, written test-first (7 vitest cases, including a midnight-boundary regression test).
- Found and fixed a latent bug while adding 24-hour support: `Intl.DateTimeFormat` with `hour12: false` under `en-US` reports midnight as hour `24`, not `00` — switched to explicit `hourCycle: "h23"`.
- `HeroBannerClient.tsx` now takes the full `cards` array + a `fallback` (the item with no `schedule-day`, picked in `page.tsx`) instead of a single card.
- Verified end-to-end against the live CMS: created a temporary scheduled test item, confirmed the client-side swap rendered it with the correct direct-link href, then deleted the test item.

**Files Modified:**
- `lib/webflow.ts` — extended `AppSliderCard`, added Option-id lookup tables, rewrote `getHeaderCards()`
- `lib/hero-schedule.ts` — new: generic pure matcher (replaces `lib/sunday-hero.ts`, deleted)
- `lib/__tests__/hero-schedule.test.ts` — new: 7 unit tests (replaces `lib/__tests__/sunday-hero.test.ts`, deleted)
- `components/home/HeroBannerClient.tsx` — accepts `cards` array instead of single `fallback` card
- `app/(tabs)/page.tsx` — passes full `sliderCards` + computed default fallback

**Status:** VERIFIED WORKING (16/16 tests pass, typecheck clean, browser-tested against live Webflow data). Client needed to populate the 4 real service-time cards — see Session 09.

---

### Session 09 (2026-08-27) — Verified client-populated Sunday schedule cards

**Goal/Problem:** Client created the 4 real service-time items in the `headerCards` collection (per Session 08); needed to confirm the Option field selections actually decode to the correct days/times before trusting it live.

**Solution:** Fetched the live collection items via the Webflow MCP and cross-checked each item's `schedule-day`/`schedule-*-hour`/`schedule-*-minute` option ids against the lookup tables in `lib/webflow.ts`. All 4 items matched the original hardcoded windows exactly (9:00–9:50, 9:50–10:10, 10:45–11:35, 11:35–11:55 AM Sunday), correct `card-text`/`card-link`/images, all published, no overlaps. Confirmed exactly one published item ("It's Complicated: Questions") has no `schedule-day` set, making it the unambiguous always-on default; a second unscheduled item ("Weekly quote") remains in draft so it's filtered out and not a conflict. No code changes this session.

**Status:** VERIFIED WORKING — client's live CMS setup is correct and ready to go.

---

### Session 07 (2026-06-22) — Fix missing Sunday card background images

**Goal/Problem:** Connect card background image not appearing in production.

**Solution:** Both Sunday card images (`connect-card-bg.png`, `salvation-card-bg.png`) existed locally but had never been committed to git, so they were absent from Vercel deployments. Added both files to git and pushed.

**Files Modified:**
- `public/images/connect-card-bg.png` — added to git (was untracked)
- `public/images/salvation-card-bg.png` — added to git (was untracked)

**Status:** VERIFIED WORKING

---

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

### Session 06 (2026-06-04) — Home screen section reorder

**Goal:** Move "Your next step" carousel above "Upcoming events" on the home screen.

**Solution:** Swapped the two `<CarouselSection>` blocks in `app/(tabs)/page.tsx`. No data or component changes needed.

**Files Modified:**
- `app/(tabs)/page.tsx` — moved "Your next step" section above "Upcoming events"

**Status:** VERIFIED WORKING (confirmed via browser DOM snapshot)

---

*Older sessions archived in `docs/Archive/sessions/` — see `session-018.md` for Session 03 (Time-gated hero banner, superseded by Session 08 above) and `session-019.md` for Session 04 (Group images in home carousel).*
