# Session 013 — Outreach Sync: Use Rock opportunity ID as Webflow slug

**Workstream:** Outreach Sync
**Date:** 2026-06-18

**Goal:** Replace name-based slug generation with the opportunity's Rock ID so slugs are stable and don't change when a project is renamed.

**Solution:** Changed `slug: slugify(rawGroup.Name)` → `slug: String(opportunity.Id)` in `transformProject`, using the GroupLocation ID (`rock_opportunity_id`) since each Webflow item represents one opportunity. Removed the now-unused `slugify` import. Updated tests to expect `"200"`.

**Files Modified:**
- `lib/sync/outreach/rock-client.ts` — slug now uses `String(opportunity.Id)`; removed `slugify` import
- `lib/__tests__/outreach-rock-client.test.ts` — updated slug assertion
- `lib/__tests__/outreach-webflow-client.test.ts` — updated `baseProject` fixture and assertion

**Status:** VERIFIED WORKING — 107/107 tests passing
