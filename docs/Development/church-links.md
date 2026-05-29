# Church Links — Development

## Overview

Home page sections that surface church connection points: the "Your Next Step" cards carousel and (planned) other link/resource sections.

## Key Files

| File | Purpose |
| ---- | ------- |
| `app/(tabs)/page.tsx` | Home page — fetches all CMS data in parallel, renders carousels |
| `lib/webflow.ts` → `getNextSteps()` | Fetches Next Steps collection, sorts by `sort-order` |
| `components/home/NextStepCard.tsx` | Individual card — colored background, title, external link arrow |
| `components/home/CarouselSection.tsx` | Horizontal scroll carousel wrapper used by all home sections |
| `components/home/HeroBanner.tsx` | Hero image card at top of home page with share sheet (Facebook/X) |

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

## Recent Sessions

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
