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
| `leader-name` | PlainText | project.leader_name (1st leader, NickName\|\|FirstName + LastName) |
| `leader-2-name` | PlainText | project.leader_name_2 (2nd leader) |
| `leader-profile-image` | PlainText | project.leader_image (Rock photo URL — currently null, see note) |
| `leader-2-profile-image` | PlainText | project.leader_image_2 (2nd leader photo — currently null) |

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
- **Tests:** 144/144 passing
- **Cron:** Active in `vercel.json` — deployed
- **Supabase table:** Populated (15 rows from latest sync); 4 leader columns added 2026-06-25
- **Webflow collection:** Live — `outreach-projects` with MultiRef fields and leader name fields
- **Reference collections:** Live — 4 collections auto-populated on each sync run (campus, event, category, city)
- **Vercel env vars:** All added (ROCK_SIGNUP_GROUP_TYPE_ID=37, WEBFLOW_OUTREACH_COLLECTION_ID, CRON_SECRET updated for both sync routes)
- **Deployment:** Live — full pipeline verified end-to-end 2026-06-25 (leader names)
- **Leader images:** Always null — Rock returns `PhotoId` (int), not a `Photo.Guid` URL; wire up when Rock exposes it

---

## Rock OData Node Limit (Critical)

Rock RMS's OData API has a **100-node limit** on filter expressions. Each `Id eq X` or `GroupId eq X` term counts as ~3 nodes, `or` connectors count as 1 each. With 20 groups, combining a GroupId OR chain with a navigation property filter (e.g. `and GroupRole/IsLeader eq true`) exceeds the limit and returns 400.

**Rule:** If building a batch filter over many IDs, do NOT combine it with a navigation property condition. Apply that filter client-side in JavaScript after fetching.

`fetchLeaderMap` hits this limit: it fetches all GroupMembers by GroupId in one call and filters `GroupRole.IsLeader` in the loop, not in the OData query.

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

### Session 07 (2026-06-25) — Fix: Reference collection items saved as draft

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

---

### Session 06 (2026-06-25) — Feature: Leader names and profile images

**Goal:** Add up to 2 leader names and photo URLs per outreach project, pulled from Rock RMS GroupMembers with a Leader role, synced through Supabase to Webflow CMS.

**Solution:**
- Added `RockRawGroupMember` interface and 4 new fields to `OutreachProject` (`leader_name`, `leader_name_2`, `leader_image`, `leader_image_2`)
- Added `fetchLeaderMap(groupIds)` to `OutreachRockClient` — one batch call to `/api/GroupMembers` expanded with Person and GroupRole, filters leaders client-side
- Wired into `fetchSignUpGroups()` via `Promise.all` alongside existing IdKey batch fetches; result passed into `transformProject()`
- Added 4 new columns to Supabase `outreach_projects` (TEXT, nullable); upsert spreads them automatically
- Added 4 PlainText fields to Webflow `outreach-projects` collection; `transformProjectForWebflow` writes them conditionally
- Name format: `(NickName || FirstName) + " " + LastName`

**Key decisions:**
- Client-side `IsLeader` filtering required: Rock's OData 100-node limit is exceeded when combining 20+ GroupId OR conditions with `and GroupRole/IsLeader eq true`. Fetch all members by GroupId, filter in JavaScript.
- Webflow slugs: Webflow assigned `leader-2-name` and `leader-2-profile-image` (not `leader-name-2` / `leader-profile-image-2` as expected) — code matches actual slugs.
- Leader photos are null: Rock returns `PhotoId` (int) on Person, not `Photo.Guid`. The `RockRawGroupMember` type has `Photo.Guid` typed as future-ready; add a comment noting it's always null until Rock exposes the URL.
- Supabase schema cache: must reload after adding new columns (`Project Settings → API → Reload schema cache`) before running sync, otherwise PostgREST silently ignores unknown fields in the upsert payload.

**Files Modified:**
- `lib/sync/outreach/types.ts` — added `RockRawGroupMember`, 4 new fields on `OutreachProject`
- `lib/sync/outreach/rock-client.ts` — added `fetchLeaderMap`, updated `transformProject` + `fetchSignUpGroups`
- `lib/sync/outreach/webflow-client.ts` — added 4 leader fields to `transformProjectForWebflow`
- `lib/__tests__/outreach-rock-client.test.ts` — 13 new tests
- `lib/__tests__/outreach-webflow-client.test.ts` — 3 new tests, updated `baseProject` fixture
- `docs/superpowers/specs/2026-06-25-outreach-leader-names-design.md` — design spec
- `docs/superpowers/plans/2026-06-25-outreach-leader-names.md` — implementation plan

**Status:** Deployed and verified — 143/143 tests passing, leader names live in Webflow

---

### Session 05 (2026-06-19) — Feature: MultiRef fields for campus/event/category/city filtering

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
