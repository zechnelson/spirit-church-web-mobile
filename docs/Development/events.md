# Events — Development

## Overview

Events carousel on the home screen. Fetches events from Webflow CMS and displays them as cards linking to each event's individual Webflow page.

## Key Files

| File | Purpose |
| ---- | ------- |
| `app/(tabs)/page.tsx` | Home page — fetches events, renders carousel |
| `lib/webflow.ts` → `getEvents()` | Fetches Events collection, resolves categories, sorts by date |
| `components/home/EventCard.tsx` | Individual card — image, title, date, time/location |
| `components/home/CarouselSection.tsx` | Horizontal scroll carousel wrapper |
| `components/home/ViewAllCard.tsx` | "See all" card linking to `spiritchurch.co/events` |

## Webflow CMS

### Events Collection (`68ae1c452c9ac726c7a74617`)

| Field | Type | Notes |
| ----- | ---- | ----- |
| `name` | PlainText | Event title |
| `slug` | PlainText | Used to build the event page URL |
| `date` | Date | Used for sorting and display |
| `timeframe` | PlainText | Time display (e.g. "8:50 AM - 11:00 AM") |
| `location-name` | PlainText | Location label |
| `address` | PlainText | Fallback if `location-name` is absent |
| `category-s` | Reference (multi) | References EventCategories collection |
| `thumbnail-image` | Image | Card thumbnail |
| `unlisted-event` | Boolean | If true, excluded from the carousel |

### EventCategories Collection (`68ae1c452c9ac726c7a746ee`)

Resolved in parallel with events fetch. Cached for 1 hour.

## URL Pattern

Event cards link to: `https://www.spiritchurch.co/events/<slug>`

Same pattern as groups (`spiritchurch.co/groups/<slug>`).

## Recent Sessions

### Session 01 (2026-06-01) — Events carousel linking

**Goal:** Link event carousel cards to their individual Webflow CMS pages instead of the `event-button-link` field.

**Solution:** Changed `getEvents()` in `lib/webflow.ts` to build `href` from the item's `slug` field, matching the groups pattern.

**Files Modified:**

- `lib/webflow.ts` — changed `href` in `getEvents()` from `fd["event-button-link"]` to `` `https://www.spiritchurch.co/events/${item.fieldData.slug}` ``

**Status:** VERIFIED WORKING
