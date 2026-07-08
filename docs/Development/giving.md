# Giving — Development

## Overview

The Giving tab in the bottom nav sends users directly to the church's external donation page (Overflow) in their browser. There is no in-app page — tapping the tab opens a new browser tab.

## Key Files

| File | Purpose |
| ---- | ------- |
| `components/nav/BottomNav.tsx` | Defines the tab bar; Giving tab uses `external: true` to render `<a target="_blank">` |

## Architecture

The Giving tab is declared with `external: true` in the `tabs` array in `BottomNav.tsx`. The render loop checks for this flag and renders a plain `<a href target="_blank" rel="noopener noreferrer">` instead of a Next.js `<Link>`. External tabs are never marked active.

```ts
{ href: "https://donate.overflow.co/spiritchurch/cash", label: "Giving", icon: Heart, external: true }
```

The `external` flag pattern in `BottomNav` is generic — any future tab can use it to open an external URL without an in-app page.

## Recent Sessions

### Session 01 (2026-07-08) — Replace iframe embed with external redirect

**Goal/Problem:** The Giving tab was embedding the Overflow donation form in an iframe, which added load complexity and a fallback error state. Simpler to just redirect to the external URL.

**Solution:** Added `external: true` to the Giving tab config. Updated `BottomNav` render loop to detect external tabs and render `<a target="_blank">` instead of `<Link>`. Deleted the now-orphaned `/app/(tabs)/giving/page.tsx`.

**Files Modified:**

- `components/nav/BottomNav.tsx` — Added external link support; Giving tab now opens browser directly
- `app/(tabs)/giving/page.tsx` — Deleted (iframe embed no longer needed)

**Status:** Committed (`062e7d6`), awaiting live testing
