# Session 016 — Outreach Sync Session 07 (2026-06-25) — Fix: Reference collection items saved as draft

Archived from `docs/Development/outreach-sync.md` (rolling window overflow, 2026-08-03).

**Goal/Problem:** Categories, cities, and other reference collection values created by the sync were `isDraft: true` in Webflow, making them invisible on the live site for filtering.

**Root cause:** `upsertReferenceItem` posted `{ fieldData: { name, slug } }` without setting `isDraft: false`. Webflow defaults new items to draft. The `publishSite` call in Stage 3 rebuilds the site with already-published content — it does not flip draft items to published.

**Solution:**
- Added `isDraft: false` to the POST body in `upsertReferenceItem` — new reference items are created in published state from the start
- Manually published all existing draft items via Webflow MCP `publish_collection_items` (5 categories + 3 cities that were stuck as drafts)
- Corrected the Session 05 note: `publishItems` does work on reference collections (the earlier 404 was likely a different issue); it's just not needed anymore since items are now created as `isDraft: false`

**Files Modified:**
- `lib/sync/outreach/webflow-client.ts` — added `isDraft: false` to `upsertReferenceItem` POST body
- `lib/__tests__/outreach-webflow-client.test.ts` — new test verifying `isDraft: false` is sent

**Status:** Deployed and verified — 144/144 tests passing, all reference items published in Webflow
