# Outreach Sync — Development

## Overview

Automated pipeline that syncs Outreach Projects (Rock RMS Sign-Up Groups) → Supabase → Webflow CMS on a 6-hour cron schedule. Mirrors the Groups Sync architecture.

Users browse Outreach Projects on a Webflow page, filter by Location (City), Campus, Event, and Category, and click a sign-up button that deep-links to the Rock RMS opportunity registration form.

## Key Files

| File | Purpose |
| ---- | ------- |
| `app/api/sync-outreach/route.ts` | GET (cron) + POST (manual) route handler — validates CRON_SECRET, calls fullOutreachSync() |
| `lib/sync/outreach/index.ts` | `fullOutreachSync()` orchestrator — Stage 1: Rock→Supabase, Stage 2: Supabase→Webflow, Stage 3: Publish |
| `lib/sync/outreach/rock-client.ts` | Fetches Sign-Up Groups from Rock RMS REST API, constructs sign-up URLs from IdKeys |
| `lib/sync/outreach/supabase-client.ts` | Upserts/queries/deletes `outreach_projects` table (raw fetch, no supabase-js) |
| `lib/sync/outreach/webflow-client.ts` | Creates/updates/deletes Webflow CMS items, publishes items + site |
| `lib/sync/outreach/types.ts` | TypeScript interfaces (OutreachProject, RockRawSignUpGroup, OutreachSyncStats, OutreachSyncEnv) |
| `lib/__tests__/outreach-rock-client.test.ts` | Unit tests for rock-client (19 tests) |
| `lib/__tests__/outreach-webflow-client.test.ts` | Unit tests for webflow-client (20 tests) |
| `lib/__tests__/outreach-sync-route.test.ts` | Route handler unit tests (7 tests) |
| `vercel.json` | Cron config: `GET /api/sync-outreach` every 6 hours |

## Architecture

```
Rock RMS REST API (Sign-Up Groups + Opportunities)
    ↓  (rock-client.ts)
Supabase `outreach_projects` table  ← upsert by rock_opportunity_id
    ↓  (supabase-client.ts)
Webflow CMS `outreach-projects` collection
    ↓  create + PATCH (webflow-client.ts)
    ↓  publishItems (up to 100/chunk)
    ↓  publishSite
```

## Supabase Table

Table: `outreach_projects` — dedup key is `rock_opportunity_id` (UNIQUE). One row per GroupLocation (Opportunity).

## Webflow Collections

| Collection | Slug | ID | Purpose |
| ---------- | ---- | -- | ------- |
| Outreach Projects | `outreach-projects` | `6a28cbac65cb0f0593f53802` | Main collection — one item per opportunity |
| Outreach Campuses | `outreach-campuses` | `6a34b321383e05c75c39e00a` | Campus filter reference collection |
| Outreach Events | `outreach-events` | `6a34b3227f7a37ca726a218f` | Event filter reference collection |
| Outreach Categories | `outreach-categories` | `6a34b32342f56dbdad8ff50b` | Category filter reference collection |
| Outreach Cities | `outreach-cities` | `6a34b3248360e1ed0c7190e6` | City filter reference collection |

Note: Campus, Event, Category, City are **MultiRef fields** on `outreach-projects` pointing to the 4 reference collections above. The sync auto-upserts missing values into those collections on every run and immediately publishes new reference items. Webflow auto-assigned `-2` suffix to the MultiRef field slugs (e.g., `campus-2`) because the old PlainText slugs were recently deleted.

**Field slugs in `outreach-projects`:**

| Field slug | Type | Source |
| ---------- | ---- | ------ |
| `name` | PlainText | project.name |
| `slug` | PlainText | generated |
| `rock-group-id` | Number | project.rock_group_id |
| `rock-opportunity-id` | Number | project.rock_opportunity_id |
| `description` | RichText | project.description |
| `schedule-display` | PlainText | project.schedule_display |
| `location-address` | PlainText | project.location_address |
| `semester` | PlainText | project.semester |
| `kids-welcome` | Switch | project.kids_welcome |
| `handicap-accessible` | Switch | project.handicap_accessible |
| `tools-needed` | PlainText | project.tools_needed |
| `project-type` | PlainText | project.project_type |
| `signup-url` | Link | project.signup_url |
| `is-active` | Switch | project.is_active |
| `campus-2` | MultiRef | project.campus → outreach-campuses collection (auto-upserted) |
| `event-2` | MultiRef | project.event → outreach-events collection (auto-upserted) |
| `category-2` | MultiRef | project.category → outreach-categories collection (auto-upserted) |
| `city-2` | MultiRef | project.city → outreach-cities collection (auto-upserted) |

## Environment Variables

| Variable | Notes |
| -------- | ----- |
| `ROCK_SIGNUP_GROUP_TYPE_ID` | GroupType ID for Sign-Up Groups in Rock |
| `WEBFLOW_OUTREACH_COLLECTION_ID` | `6a28cbac65cb0f0593f53802` |

Reuses: `CRON_SECRET`, `ROCK_API_URL`, `ROCK_REST_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WEBFLOW_API_TOKEN`, `WEBFLOW_SITE_ID`

Note: The 4 reference collection env vars (`WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID` etc.) are no longer needed — campus/event/category/city are PlainText fields.

## Triggering Manually

```bash
curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-outreach \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected response:
```json
{
  "success": true,
  "stats": {
    "startedAt": "...",
    "rockToSupabase": { "processed": 5, "status": "success" },
    "supabaseToWebflow": { "created": 5, "updated": 0, "deleted": 0, "published": 5, "status": "success" },
    "duration": 4200
  }
}
```

## Active/Archived Handling

| Rock State | Action |
| ---------- | ------ |
| `IsActive=false`, `IsArchived=false` | Syncs `is-active: false` to Webflow. Item stays in CMS but filtered out on the public page. |
| `IsArchived=true` | Hard delete from Webflow CMS and Supabase. |

## Rock Attribute Keys (Verified 2026-06-11)

All 7 attribute key names in `rock-client.ts` confirmed against live Rock API:

`Semester`, `Event`, `Category`, `KidsWelcome`, `HandicapAccessible`, `ToolsSuppliesNeeded`, `ProjectType`

## Webflow Site & Collection IDs

| Resource | ID |
| -------- | -- |
| Site (spirit-church-az) | `68ae1c452c9ac726c7a745ee` |
| `outreach-projects` collection | `6a28cbac65cb0f0593f53802` |

## Current Status

- **Code:** Complete and deployed
- **Tests:** 46/46 passing
- **Cron:** Active in `vercel.json` — deployed
- **Supabase table:** Created and populated (2 rows from first sync)
- **Webflow collection:** Live — `outreach-projects` with all 18 fields, 2 items published
- **Vercel env vars:** All added (ROCK_SIGNUP_GROUP_TYPE_ID=37, WEBFLOW_OUTREACH_COLLECTION_ID, CRON_SECRET updated for both sync routes)
- **Deployment:** Live — full pipeline verified end-to-end 2026-06-11

---

## Rock IdKey Batch-Fetch (Critical)

Rock RMS strips `IdKey` (a computed property) from **all OData list endpoint responses** — this affects Groups, GroupLocations, and Schedules alike. If IdKey is null for any of the three, `signup_url` will be null.

**Solution:** After the main groups fetch, run 3 parallel batch queries to retrieve IdKeys:

```
Groups?$filter=Id eq X or Id eq Y or ...
GroupLocations?$filter=Id eq X or Id eq Y or ...
Schedules?$filter=Id eq X or Id eq Y or ...
```

Do **not** use `$select=Id,IdKey` — computed properties are stripped from `$select` results too. Query with `$filter` only and Rock returns full objects including IdKey.

`transformProject` uses `rawData.IdKey ?? batchMap?.get(id) ?? null` fallback pattern, so if Rock ever adds IdKey to list responses this code gracefully stops using the batch maps.

---

## Recent Sessions

### Session 05 (2026-06-19) — Feature: MultiRef fields for campus/event/category/city filtering

**Goal:** Replace PlainText campus/event/category/city fields with MultiRef fields to enable proper Webflow CMS filtering on the public outreach page.

**Solution:**
- Created 4 new Webflow reference collections (outreach-campuses, outreach-events, outreach-categories, outreach-cities)
- Deleted 4 PlainText fields from outreach-projects; added 4 MultiRef fields (Webflow auto-assigned `-2` suffix to field slugs: `campus-2`, `event-2`, `category-2`, `city-2`)
- Added `fetchReferenceCollection`, `mapValuesToIds`, `upsertReferenceItem`, `syncReferenceCollection`, `initializeReferenceMaps` to `OutreachWebflowClient`
- Each sync run auto-upserts missing values into the reference collections and immediately publishes new items
- Added `initializeReferenceMaps(supabaseProjects)` call in `index.ts` before Stage 2

**Key decisions:**
- `initializeReferenceMaps` uses sequential awaits (not `Promise.all`) — required by test mock design; works correctly with Webflow API
- `upsertReferenceItem` publishes newly created reference items immediately after creation (so they're live before the parent outreach-projects items are published)
- Empty slug fallback: if name produces empty string from slug regex, falls back to `ref-${Date.now()}`
- Field slug suffix `-2` is permanent (Webflow behavior after recent same-name deletion); front-end bindings must use `campus-2` etc.

**Files Modified:**
- `lib/sync/outreach/webflow-client.ts` — new reference collection methods, updated transform
- `lib/sync/outreach/index.ts` — added initializeReferenceMaps call
- `lib/__tests__/outreach-webflow-client.test.ts` — updated and expanded tests (37 tests)
- `docs/Development/outreach-sync.md` — updated collection table and field schema

**Status:** Deployed and verified — 129/129 tests passing

---

### Session 04 (2026-06-18) — Change: Use Rock opportunity ID as Webflow slug

**Goal:** Replace name-based slug generation with the opportunity's Rock ID so slugs are stable and don't change when a project is renamed.

**Solution:** Changed `slug: slugify(rawGroup.Name)` → `slug: String(opportunity.Id)` in `transformProject`, using the GroupLocation ID (`rock_opportunity_id`) since each Webflow item represents one opportunity. Removed the now-unused `slugify` import. Updated tests to expect `"200"`.

**Files Modified:**
- `lib/sync/outreach/rock-client.ts` — slug now uses `String(opportunity.Id)`; removed `slugify` import
- `lib/__tests__/outreach-rock-client.test.ts` — updated slug assertion
- `lib/__tests__/outreach-webflow-client.test.ts` — updated `baseProject` fixture and assertion

**Status:** VERIFIED WORKING — 107/107 tests passing

---

### Session 01 (2026-06-09) — Implementation

**Goal:** Build full Rock RMS → Supabase → Webflow sync pipeline for Outreach Projects (Sign-Up Groups).

**Solution:** Implemented all 6 code tasks (types, rock-client, supabase-client, webflow-client, orchestrator, route handler) with TDD. 112/112 tests passing. Added cron entry to `vercel.json`. Supabase table created. Blocked on Webflow collection setup and Vercel env vars before deploying.

**Key decisions:**
- Flat Supabase schema (one row per opportunity, not normalized) — appropriate for 1:1 group:opportunity starting state
- `existingMap` keyed by `rock-opportunity-id` (not `rock-id`) since each Webflow item represents an opportunity
- Boolean fields (kids_welcome, handicap_accessible) stored as Webflow Switch, not Ref
- Sign-up URL is null if any IdKey is missing from Rock API response (graceful fallback)
- Rock attribute key names are guesses — must verify via diagnostic curl before first sync

**Files created:**
- `lib/sync/outreach/types.ts`, `rock-client.ts`, `supabase-client.ts`, `webflow-client.ts`, `index.ts`
- `app/api/sync-outreach/route.ts`
- `lib/__tests__/outreach-rock-client.test.ts`, `outreach-webflow-client.test.ts`, `outreach-sync-route.test.ts`

**Files modified:**
- `vercel.json` — added `/api/sync-outreach` cron entry

**Next session — Task 0 remaining steps:**
1. ~~Create Webflow collection~~ ✓ Done 2026-06-11 (`outreach-projects` with all 16 fields)
2. Update `webflow-client.ts` — remove ref collection lookups, write campus/event/category/city as PlainText strings directly
3. Update tests in `outreach-webflow-client.test.ts` to match new field behavior
4. Add 2 env vars to Vercel: `ROCK_SIGNUP_GROUP_TYPE_ID` + `WEBFLOW_OUTREACH_COLLECTION_ID` (`6a28cbac65cb0f0593f53802`)
5. Pull env locally: `vercel env pull --environment production .env.local`
6. Verify Rock attribute key names via diagnostic curl
7. Deploy: `vercel build --prod && vercel deploy --prebuilt --prod`
8. Trigger manual sync and verify end-to-end

---

### Session 02 (2026-06-11) — Webflow Collection

**Goal:** Create Webflow CMS collection for Outreach Sync pipeline (Task 0, Step 1).

**What happened:** Initially created collections on wrong site (Spirit Church Staging `68bf98e2590d4a39fb6f9bb8`). Correct site is `68ae1c452c9ac726c7a745ee`. After reconnecting Webflow MCP, hit the 20-collection CMS plan limit — couldn't create 4 reference collections. Changed architecture: campus/event/category/city are now PlainText fields on `outreach-projects` instead of Reference fields.

**Solution:** Added all 16 fields to existing `outreach-projects` collection (`6a28cbac65cb0f0593f53802`) on correct site. Field slugs all match the schema.

**Key decisions:**
- campus/event/category/city changed from Ref to PlainText — Spirit Church site is at 20-collection CMS plan limit
- Eliminates campusMap/eventMap/categoryMap/cityMap lookups in webflow-client.ts — simpler sync, string values written directly
- Wrong-site collections (on `68bf98e2590d4a39fb6f9bb8`) must be manually deleted in Webflow Designer

**Next:** Update `webflow-client.ts` to remove ref lookups, update tests, then add env vars.

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
