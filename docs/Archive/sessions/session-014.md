# Session 014 — Outreach Sync: MultiRef fields for campus/event/category/city filtering

**Workstream:** Outreach Sync
**Date:** 2026-06-19

**Goal:** Replace PlainText campus/event/category/city fields with MultiRef fields to enable proper Webflow CMS filtering on the public outreach page.

**Solution:**
- Created 4 new Webflow reference collections (outreach-campuses, outreach-events, outreach-categories, outreach-cities)
- Deleted 4 PlainText fields from outreach-projects; added 4 MultiRef fields (Webflow auto-assigned `-2` suffix to field slugs: `campus-2`, `event-2`, `category-2`, `city-2`)
- Added `fetchReferenceCollection`, `mapValuesToIds`, `upsertReferenceItem`, `syncReferenceCollection`, `initializeReferenceMaps` to `OutreachWebflowClient`
- Each sync run auto-upserts missing values into the reference collections; `publishSite` in Stage 3 covers the site rebuild
- Added `initializeReferenceMaps(supabaseProjects)` call in `index.ts` before Stage 2

**Key decisions:**
- `initializeReferenceMaps` uses sequential awaits (not `Promise.all`) — required by test mock design; works correctly with Webflow API
- Reference collection items were initially left as `isDraft: true` with the assumption that `publishSite` would cover them — this was wrong. Fixed in Session 07: items are now created with `isDraft: false`.
- Empty slug fallback: if name produces empty string from slug regex, falls back to `ref-${Date.now()}`
- Field slug suffix `-2` is permanent (Webflow behavior after recent same-name deletion); front-end bindings must use `campus-2` etc.
- Filter `v != null` (loose equality) used in `initializeReferenceMaps` to catch both null and undefined values from Supabase

**Files Modified:**
- `lib/sync/outreach/webflow-client.ts` — new reference collection methods, updated transform
- `lib/sync/outreach/index.ts` — added initializeReferenceMaps call
- `lib/__tests__/outreach-webflow-client.test.ts` — updated and expanded tests
- `docs/Development/outreach-sync.md` — updated collection table and field schema

**Status:** Deployed and verified — 127/127 tests passing
