# Archived Session: Outreach Sync — Session 03

**Workstream:** Outreach Sync
**Date:** 2026-06-11
**Original doc:** `docs/Development/outreach-sync.md`

---

### Session 03 (2026-06-11) — Deployment + Pipeline Verification

**Goal:** Deploy outreach sync, run full end-to-end pipeline test.

**What happened:**
1. Deployed code (post webflow-client.ts + types + index + route.ts refactor from Session 02)
2. Added env vars to Vercel: `ROCK_SIGNUP_GROUP_TYPE_ID=37`, `WEBFLOW_OUTREACH_COLLECTION_ID=6a28cbac65cb0f0593f53802`, and new `CRON_SECRET`
3. Hit CRON_SECRET mismatch (sensitive env vars not pulled by `vercel env pull`) — added manually to .env.local
4. Hit deploy-bakes-env-vars issue — CRON_SECRET update required a redeploy to take effect
5. First sync succeeded: 2 items created in Supabase and Webflow, published — but `signup_url` was null for both
6. **Root cause:** Rock strips IdKey from OData list responses (Groups, GroupLocations, Schedules). `$select=Id,IdKey` also doesn't work — computed property stripped there too.
7. **Fix:** Added `fetchIdKeyMap` private method; after main groups fetch, batch-fetch all 3 entity IdKeys in parallel (no `$select`, just `$filter`). Updated `transformProject` to accept 3 optional maps and use `rawData.IdKey ?? batchMap?.get(id) ?? null`.
8. Redeployed, re-triggered manual sync — both items updated with correct signup URLs.
9. Verified in Webflow: both items have correct `signup-url`, all fields populated, `isDraft: false`, `lastPublished` set.

**Key decisions:**
- `fetchIdKeyMap` degrades gracefully — if batch fetch fails (non-ok), returns empty map and signup_url falls back to null (logged as warning, not thrown)
- `transformProject` signature keeps optional map params so existing unit tests (which set IdKey directly in test data) continue to pass without changes

**Files modified:**
- `lib/sync/outreach/rock-client.ts` — added fetchIdKeyMap, batch-fetch all 3 entity IdKeys, updated transformProject signature

**Status after session:** Full pipeline live and verified. ROCK_SIGNUP_GROUP_TYPE_ID=37 confirmed.
