# Outreach Sync — Development

## Status: DECOMMISSIONED (2026-08-03)

This pipeline (Rock RMS → Supabase → Webflow CMS for Outreach Projects) has been removed from this repo. A different sync process now handles Outreach Projects → Webflow outside of this codebase, mirroring [[groups-sync]].

**Removed in this repo:**
- `app/api/sync-outreach/` route (GET/POST handler)
- `lib/sync/` (entire directory — `outreach/index.ts`, `outreach/rock-client.ts`, `outreach/supabase-client.ts`, `outreach/webflow-client.ts`, `outreach/types.ts`, and `utils.ts`, since `utils.ts`'s `log`/`logError` helpers had no remaining callers after [[groups-sync]] was already decommissioned)
- `lib/__tests__/outreach-rock-client.test.ts`, `outreach-sync-route.test.ts`, `outreach-webflow-client.test.ts`
- `sync-outreach` cron entry removed from `vercel.json` (now an empty `crons` array — it was the last remaining cron)

The content below is retained as historical reference for the decommissioned pipeline.

---

## Overview (historical)

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
- **Tests:** 145/145 passing
- **Cron:** Active in `vercel.json` — deployed
- **Supabase table:** Populated (16 rows from latest sync); 4 leader columns added 2026-06-25
- **Webflow collection:** Live — `outreach-projects` with MultiRef fields and leader name fields
- **Reference collections:** Live — 4 collections auto-populated on each sync run (campus, event, category, city)
- **Vercel env vars:** All added (ROCK_SIGNUP_GROUP_TYPE_ID=37, WEBFLOW_OUTREACH_COLLECTION_ID, CRON_SECRET updated for both sync routes)
- **Deployment:** Live — last deployed 2026-07-01 (active-only filter + orphan cleanup)
- **Rock filter:** Only `IsActive eq true` groups are fetched — inactive groups are skipped entirely
- **Orphan cleanup:** Stage 2 reconciles Supabase and Webflow against Rock on every run; stale records are auto-deleted
- **Leader images:** Always null — Rock returns `PhotoId` (int), not a `Photo.Guid` URL; wire up when Rock exposes it
- **Available spots:** Planned — spec at `docs/superpowers/specs/2026-06-27-outreach-available-spots-design.md`, implementation plan at `docs/superpowers/plans/2026-06-28-outreach-available-spots.md`

---

## Rock OData Node Limit (Critical)

Rock RMS's OData API has a **100-node limit** on filter expressions. Each `Id eq X` or `GroupId eq X` term counts as ~3 nodes, `or` connectors count as 1 each. With 20 groups, combining a GroupId OR chain with a navigation property filter (e.g. `and GroupRole/IsLeader eq true`) exceeds the limit and returns 400.

**Rule:** If building a batch filter over many IDs, do NOT combine it with a navigation property condition. Apply that filter client-side in JavaScript after fetching. Chunk all batch ID filters at 15 IDs per request.

`fetchIdKeyMap`, `fetchLeaderMap`, and `fetchAssignmentCountMap` all chunk at 15 IDs. `fetchLeaderMap` additionally filters `GroupRole.IsLeader` client-side (not in OData) because combining a large GroupId OR chain with a navigation property condition also exceeds the limit.

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

### Session 12 (2026-08-03) — Decommission: Remove pipeline, replaced by new sync process

**Goal:** A different sync process now handles Rock RMS → Webflow for Outreach Projects. Remove the cron, route, and all Supabase/Webflow outreach-sync code from this repo.

**Solution:** Deleted `app/api/sync-outreach/`, `lib/sync/outreach/` (all 5 files), and their tests (`outreach-rock-client.test.ts`, `outreach-sync-route.test.ts`, `outreach-webflow-client.test.ts`). Also deleted `lib/sync/utils.ts` and the now-empty `lib/sync/` directory — confirmed via grep that `log`/`logError` had no callers left outside the outreach code being removed (groups-sync, the other former consumer, was already decommissioned 2026-07-29). Set `vercel.json` `crons` to an empty array since `sync-outreach` was the last remaining cron entry. Updated `CLAUDE.md` workstream status and TOC.

**Verified:** `npx vitest run` — 14/14 tests passing (down from 145; all removed tests were outreach-sync-specific). `npx tsc --noEmit` clean after clearing stale `.next` cache.

**Files Modified:**
- Deleted: `app/api/sync-outreach/route.ts`, `lib/sync/` (entire directory), `lib/__tests__/outreach-rock-client.test.ts`, `lib/__tests__/outreach-sync-route.test.ts`, `lib/__tests__/outreach-webflow-client.test.ts`
- `vercel.json` — `crons` set to `[]`
- `CLAUDE.md` — Outreach Sync status → DECOMMISSIONED, TOC description updated
- `docs/Development/groups-sync.md` — cross-reference note updated (outreach-sync no longer depends on `lib/sync/utils.ts`, since it's deleted too)

**Status:** DECOMMISSIONED — see status note at top of this doc.

---

### Session 11 (2026-07-01) — Fix: Inactive groups syncing to Supabase/Webflow + orphan cleanup

**Goal/Problem:** Supabase and Webflow had 18 outreach records but Rock only showed 16 in the Sign-Up Overview. Two extra records were inactive groups (`IsActive=false`) that the sync was including per the original spec but the user doesn't want.

**Root cause (two issues):**
1. Rock's API excludes deleted/archived groups from its response entirely — they just disappear. The sync only deleted records when Rock returned `IsArchived=true`, so groups removed from Rock accumulated as stale orphans in Supabase/Webflow.
2. Inactive groups (`IsActive=false`) were being synced to Supabase/Webflow with `is-active: false` per original design spec, but the desired behavior is to only sync active groups.

**Solution:**
- Added orphan reconciliation to `index.ts` Stage 2: after fetching Supabase projects, compares `rock_group_id` set against what Rock returned and deletes any rows not present in Rock. Also detects Webflow items whose `rock-opportunity-id` is not in the clean Supabase set and deletes them. Both deletion paths are combined (deduped) for the Webflow `deleteItems` call.
- Added `and IsActive eq true` to the Rock API `$filter` in `rock-client.ts` so only active groups are fetched. On next sync, the orphan cleanup automatically removed the 2 stale inactive records.

**Files Modified:**
- `lib/sync/outreach/index.ts` — Stage 2 orphan reconciliation (Supabase + Webflow)
- `lib/sync/outreach/rock-client.ts` — added `IsActive eq true` to Rock API filter

**Status:** Deployed and verified — 145/145 tests passing, sync shows `processed: 16, deleted: 2`, counts match Rock

---

### Session 10 (2026-06-28) — Planning: Available spots and is_full fields

**Goal:** Research and design syncing available spot count and a full indicator for each outreach project from Rock RMS.

**Research findings:**
- `GroupLocationScheduleConfigs` (added to the existing Groups `$expand`) provides `MaximumCapacity` per GroupLocation+Schedule — always set for active Spirit Church projects
- `GroupMemberAssignments` endpoint supports batch `GroupId` filtering with `$select=GroupId,LocationId,ScheduleId` — same chunked pattern as other batch fetches
- Available spots = `MaximumCapacity − count(assignments for groupId|locationId|scheduleId)` at sync time
- New fields: `spots_available` (int, nullable) and `is_full` (bool)

**Decisions:**
- Display as a number, not live-updated — 6-hour cron snapshot is acceptable
- `is_full` boolean flag (rather than showing "0") so the frontend can render a "Full" label
- Over-subscribed clamp: if filled > max, `spots_available = 0` and `is_full = true`
- Graceful degradation: if assignment fetch fails, sync continues with `spots_available = null`, `is_full = false`

**Artifacts:**
- Design spec: `docs/superpowers/specs/2026-06-27-outreach-available-spots-design.md`
- Implementation plan: `docs/superpowers/plans/2026-06-28-outreach-available-spots.md`

**Status:** Planning complete — no code written yet, implementation plan ready to execute

---

### Session 09 (2026-06-27) — Fix: OData node limit on IdKey batch fetches + publishSite domain bug

**Goal/Problem:** Sign-up URLs were null for all projects after group count grew from 15 → 22. publishSite was also silently failing on every sync run.

**Root causes:**
1. `fetchIdKeyMap` and `fetchLeaderMap` sent all group IDs in a single OData filter. At 22 IDs the filter hit Rock's ~100-node limit and returned 400 → empty IdKey maps → every `groupIdKey` null → every sign-up URL null.
2. `publishSite` mapped `customDomains` to `.url` strings but Webflow v2 `POST /sites/{id}/publish` expects `customDomains` as an array of domain **IDs** (not URLs). Was silently failing since launch.

**Solution:**
- Chunked `fetchIdKeyMap` to 15 IDs per request (15 × 3 nodes + 14 ors = 59 nodes, safely under limit)
- Chunked `fetchLeaderMap` the same way; merged results across chunks
- In `publishSite`, changed `.url` → `.id` in the `customDomains` map (kept field name `customDomains`, which is what Webflow v2 expects)

**Files Modified:**
- `lib/sync/outreach/rock-client.ts` — chunked `fetchIdKeyMap` and `fetchLeaderMap`
- `lib/sync/outreach/webflow-client.ts` — map `d.id` instead of `d.url` in `publishSite`

**Status:** Deployed and verified — 145/145 tests passing, sync log shows no warnings, `Site published` line confirmed, Webflow site live

---

### Session 08 (2026-06-25) — Fix: Sign-up URLs using wrong location IdKey

**Goal/Problem:** All sign-up URLs in Webflow produced "project occurrence not found" in Rock RMS when clicked.

**Root cause:** Rock's sign-up URL format is `/signups/register/{groupIdKey}/location/{locationIdKey}/schedule/{scheduleIdKey}`. The `location` segment expects the **`Location` entity's IdKey** (the actual address entity), not the **`GroupLocation` entity's IdKey** (the join table between Group and Location). These are two different Rock entities with different IdKeys. The batch fetch was hitting `GroupLocations?$filter=Id eq ...` and using `GroupLocation.IdKey`, but Rock needed `Location.IdKey`.

**Solution:**
- Added `Id` and `IdKey` to the `Location` interface in `types.ts`
- Changed batch fetch endpoint from `GroupLocations` to `Locations`, using `Location?.Id` to collect IDs
- Updated `transformProject` to use `opportunity.Location?.IdKey` (with batch map fallback via `Location.Id`)
- Added a new test verifying the batch fallback path for location IdKey

**Files Modified:**
- `lib/sync/outreach/types.ts` — added `Id` and `IdKey` to `Location` interface
- `lib/sync/outreach/rock-client.ts` — batch fetch uses `Locations` endpoint; transform uses `Location.IdKey`
- `lib/__tests__/outreach-rock-client.test.ts` — updated fixture, signup_url assertion, null-IdKey test, added batch fallback test

**Status:** Deployed and verified — 145/145 tests passing, all 15 sign-up URLs corrected and confirmed working

---

Older sessions archived: Session 07 → `docs/Archive/sessions/session-016.md`


