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
