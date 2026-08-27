# Session 018 — Church Links: Time-gated hero banner (archived from church-links.md)

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

**Note:** This entire hardcoded-schedule approach was superseded by Session 08 (2026-08-27), which moved scheduling into the Webflow CMS (`headerCards` collection schedule fields) and replaced `lib/sunday-hero.ts` with the generic `lib/hero-schedule.ts`.
