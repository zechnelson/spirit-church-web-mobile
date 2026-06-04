# Session 001 — Church Links: Next Steps CMS connection

**Workstream:** Church Links
**Date:** 2026-05-15

## Goal

Replace hardcoded Next Steps cards with Webflow CMS-managed items.

## Solution

- Created "Next Steps" collection in Webflow with `Name`, `Link`, and `Sort Order` (integer) fields
- Added `getNextSteps()` to `lib/webflow.ts` — fetches, filters drafts/archived, sorts by `sort-order`
- Updated `page.tsx` to fetch next steps in parallel with other CMS calls
- Color palette set to brand-900, brand-500, brand-350, warm-300 cycling by index

## Files Modified

- `lib/webflow.ts` — added `nextSteps` collection ID, `AppNextStep` interface, `getNextSteps()`
- `app/(tabs)/page.tsx` — replaced hardcoded array with CMS fetch, updated color palette

## Status

VERIFIED WORKING (4 items live in Webflow)
