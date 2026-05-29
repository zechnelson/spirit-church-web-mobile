# Time-Gated Hero Banner

**Date:** 2026-05-29
**Status:** Approved

## Summary

The HeroBanner on the home page shows contextual cards based on the time of day on Sundays during Spirit Church's in-person services. Outside service windows, it falls back to the CMS-driven shareable quote.

## Time Windows

Spirit Church meets at Hamilton High School, Chandler AZ. Two Sunday services, 70 minutes each. All times in Arizona time (America/Phoenix, UTC-7, no DST).

| Window | Card |
|---|---|
| Sun 9:00–9:50 AM | Connect with us |
| Sun 9:50–10:10 AM | I said yes to Jesus |
| Sun 10:45–11:35 AM | Connect with us |
| Sun 11:35–11:55 AM | I said yes to Jesus |
| All other times | CMS shareable quote (current behavior) |

## Card Config

**Connect with us**
- Text: `Connect with us`
- href: `https://www.spiritchurch.co/connection-card`
- imageSrc: `/images/header-card-bg.png` (placeholder — replace with dedicated photo)

**I said yes to Jesus**
- Text: `I said "yes" to Jesus`
- href: `https://www.spiritchurch.co/connect/salvation`
- imageSrc: `/images/header-card-bg.png` (placeholder — replace with dedicated photo)

## Architecture

### `lib/sunday-hero.ts` — time utility

Pure function `getSundayHeroCard()` with no side effects:
1. Gets current time in `America/Phoenix` timezone via `Intl.DateTimeFormat`
2. Returns early with `null` if today is not Sunday
3. Computes minutes since midnight and checks against service window ranges
4. Returns `{ text, href, imageSrc }` for the matching window, or `null`

### `components/home/HeroBannerClient.tsx` — client wrapper

- `"use client"` component
- Props: `fallback: { text: string; href: string; imageSrc?: string }`
- Calls `getSundayHeroCard()` synchronously on mount (no async, no loading state)
- Renders the Sunday card if one is returned, otherwise renders the fallback
- Internally renders the existing `HeroBanner` component — no changes to HeroBanner itself

### `app/(tabs)/page.tsx` — minimal change

- Replaces the direct `<HeroBanner>` render with `<HeroBannerClient fallback={hero} />`
- Remains a server component; CMS data fetch is unchanged

## Visual

All three card variants use the existing `HeroBanner` component unchanged — same layout, background image, gradient overlay, text, and share button.

## Out of Scope

- Live polling / auto-swap while the page is open (card updates on next navigation to Home)
- Admin UI for editing service times
- Per-service image customization (images are placeholders until photos are provided)
