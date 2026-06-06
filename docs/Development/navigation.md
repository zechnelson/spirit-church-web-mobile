# Navigation — Development

## Overview

Shared navigation components used across all pages. Currently a single `BottomNav` tab bar fixed to the bottom of the viewport.

## Key Files

| File | Purpose |
| ---- | ------- |
| `components/nav/BottomNav.tsx` | Bottom tab bar — Home, Notes, Events, Giving |
| `app/(tabs)/layout.tsx` | Wraps all tab pages with `BottomNav` and `pb-20` content offset |

## Architecture

- `BottomNav` is a `"use client"` component rendered inside `app/(tabs)/layout.tsx`
- Active tab detection: exact match for `/`, `startsWith` for all others
- Active style: `text-brand-600`, stroke width `2.5` vs `1.75` for inactive
- Content area uses `pb-20` to clear the fixed nav bar

## Recent Sessions

### Session 02 (2026-06-06) — Remove hide-on-scroll, always-visible nav

**Goal/Problem:** Remove the hide-on-scroll behavior so the bottom nav is always visible.

**Solution:**
- Removed `hidden` state, `lastScrollY` ref, scroll event listener, and `transition-transform` classes from `BottomNav`
- Nav is now always `fixed bottom-0`, no transform applied

**Files Modified:**
- `components/nav/BottomNav.tsx` — stripped scroll logic, simplified to static sticky nav

**Status:** VERIFIED WORKING

### Session 01 (2026-05-29) — Hide-on-scroll behavior

**Goal:** Hide the bottom nav when scrolling down, reveal it when scrolling back up.

**Solution:**
- Added `hidden` state and `lastScrollY` ref to `BottomNav`
- `window` scroll listener (passive) sets `hidden = true` when scrolling down past 60px, `false` on any upward scroll
- 60px threshold prevents hiding on small bounces at the top of the page
- CSS: `transition-transform duration-300 ease-in-out` + `translate-y-full` / `translate-y-0`

**Files Modified:**
- `components/nav/BottomNav.tsx` — added scroll listener, hidden state, transition classes

**Status:** VERIFIED WORKING
