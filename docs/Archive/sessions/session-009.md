# Archived Session — Church Links / Session 02

**Source:** `docs/Development/church-links.md`

---

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
