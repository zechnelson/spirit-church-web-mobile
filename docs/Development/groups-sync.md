# Groups Sync — Development

## Status: DECOMMISSIONED (2026-07-29)

This pipeline (Rock RMS → Supabase → Webflow CMS for Connect Groups) has been removed from this repo. A different sync process now handles Connect Groups → Webflow outside of this codebase.

**Removed in this repo:**
- `app/api/sync-groups/` route (GET/POST handler + tests)
- `lib/sync/index.ts`, `rock-client.ts`, `supabase-client.ts`, `webflow-client.ts`, `types.ts`
- `lib/__tests__/rock-client.test.ts`, `webflow-client.test.ts`, `sync-utils.test.ts`
- `scripts/publish-all-groups.ts`
- Groups-only helpers (`slugify`, `calculateSpotsAvailable`, `convertTo12Hour`, `parseMultiSelectAttribute`, `getImageUrl`) trimmed from `lib/sync/utils.ts`
- `sync-groups` cron entry removed from `vercel.json`

**Kept:** `lib/sync/utils.ts` (`log`/`logError` only) — still used by [[outreach-sync]]'s pipeline, which is unaffected by this removal.

The content below is retained as historical reference for the decommissioned pipeline.

---

## Overview (historical)

Automated pipeline that synced Connect Groups from Rock RMS → Supabase → Webflow CMS on a 6-hour cron schedule. Replaced a legacy Cloudflare Worker. The key bug this migration fixed: Webflow items were created as drafts and never published.

## Key Files

| File | Purpose |
| ---- | ------- |
| `app/api/sync-groups/route.ts` | GET (cron) + POST (manual) route handler — validates CRON_SECRET, calls fullSync() |
| `lib/sync/index.ts` | `fullSync()` orchestrator — Stage 1: Rock→Supabase, Stage 2: Supabase→Webflow, Stage 3: Publish |
| `lib/sync/rock-client.ts` | Fetches active groups from Rock RMS REST API |
| `lib/sync/supabase-client.ts` | Upserts groups to Supabase (raw fetch, no supabase-js), queries all groups |
| `lib/sync/webflow-client.ts` | Creates/updates Webflow CMS items, publishes items + site |
| `lib/sync/types.ts` | Shared TypeScript interfaces (`SyncGroup`, `WebflowItem`, `SyncEnv`, `SyncStats`) |
| `lib/sync/utils.ts` | `log()`, `logError()`, `generateSlug()`, `calculateSpotsAvailable()` |
| `lib/__tests__/webflow-client.test.ts` | Unit tests for transform and publish logic |
| `lib/__tests__/rock-client.test.ts` | Unit tests for Rock RMS data mapping |
| `lib/__tests__/utils.test.ts` | Unit tests for slug generation and spots calculation |
| `lib/__tests__/sync-route.test.ts` | Route handler unit tests |
| `scripts/publish-all-groups.ts` | One-time utility — publishes all draft items in a Webflow collection |
| `vercel.json` | Cron config: `GET /api/sync-groups` every 6 hours |

## Architecture

```
Rock RMS REST API
    ↓  (rock-client.ts)
Supabase `groups` table  ← upsert by rock_id
    ↓  (supabase-client.ts)
Webflow CMS collection
    ↓  create + PATCH (webflow-client.ts)
    ↓  publishItems (up to 100/chunk)
    ↓  publishSite (triggers Webflow rebuild)
```

## Webflow Collection

**Collection ID:** `694eff6ac57ffe6994797761`

Valid field slugs (as returned by the Webflow v2 API):

| Field slug | Type | Source |
| ---------- | ---- | ------ |
| `name` | PlainText | `group.name` |
| `slug` | PlainText | generated from name |
| `rock-id` | Number | `group.rock_id` |
| `description-2` | RichText | `group.description` |
| `schedule-description` | PlainText | `group.schedule_description` |
| `registration-url` | Link | `group.registration_url` |
| `is-active` | Switch | `group.is_active` |
| `is-public-2` | Switch | `group.is_public` |
| `group-topics` | MultiRef | `group.topics` → topicsMap |
| `audience` | MultiRef | `group.audience` → audiencesMap |
| `group-life-stages` | MultiRef | `group.life_stages` → lifeStagesMap |
| `city` | Ref | `group.city` → cityMap |
| `childcare-available` | Ref | `group.childcare_provided` → childcareMap |
| `kids-welcome` | Ref | `group.kids_welcome` → kidsWelcomeMap |
| `group-image-3` | PlainText | `group.group_image` (Rock RMS URL string — publicly accessible) |

> **Note:** `group-image` (Webflow Image type) exists in the collection but is always null — Webflow cannot fetch the Rock image URL during CMS item creation. `group-image-3` is a PlainText field that stores the raw URL. The app reads `group-image-3` directly and Next.js serves it via the `rms.spiritchurch.co` remote pattern.

**Fields NOT in schema** (do not send in PATCH/POST): `campus-2`, `group-type-2`, `meeting-time`, `capacity`, `current-members`, `spots-available`, `group-image` (Image type — always null, use `group-image-3` instead).

## Reference Collections

| Collection | ID | Purpose |
| ---------- | -- | ------- |
| Topics | `696eff5aa4cda76f8c6de386` | Group topic multi-ref |
| Audiences | `696eff2807ed1fc6a1eb8db0` | Audience multi-ref |
| Life Stages | `696eff96dbc04d12d51b34e1` | Life stage multi-ref |
| City | `6970957a11505bf2aa488045` | City single-ref |
| Childcare | `69719d2a11b310551fda1713` | Childcare single-ref |
| Kids Welcome | `69719e7b17501e7b8c9e9179` | Kids welcome single-ref |

## Environment Variables

| Variable | Where set |
| -------- | --------- |
| `ROCK_API_URL` | Vercel (non-sensitive) |
| `ROCK_REST_KEY` | Vercel (sensitive) |
| `SUPABASE_URL` | Vercel (non-sensitive) |
| `SUPABASE_SERVICE_KEY` | Vercel (sensitive) |
| `WEBFLOW_API_TOKEN` | Vercel (sensitive) — `vercel env pull` will not return this; it IS available at runtime |
| `WEBFLOW_SITE_ID` | Vercel (non-sensitive) — `68ae1c452c9ac726c7a745ee` |
| `WEBFLOW_COLLECTION_ID` | Vercel (non-sensitive) — `694eff6ac57ffe6994797761` |
| `CRON_SECRET` | Vercel (sensitive) — bearer token for POST/GET auth |

> **Note:** Vercel marks `WEBFLOW_API_TOKEN` as sensitive. `vercel env pull --environment production .env.local` will not include it. Add manually if needed locally.

## Triggering Manually

```bash
curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-groups \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected response:
```json
{
  "success": true,
  "stats": {
    "rockToSupabase": { "processed": 10, "status": "success" },
    "supabaseToWebflow": { "processed": 36, "created": 0, "updated": 27, "published": 27, "status": "success" }
  }
}
```

## Current Status

- **Cron:** Active — fires every 6 hours via `vercel.json`
- **Sync verified working:** 2026-05-30 — `created: 9, updated: 27, published: 36`
- **Publishing:** Fixed — items are published immediately after create/update
- **Cloudflare Worker:** Decommissioned (2026-05-30) — Vercel cron is the sole sync mechanism
- **Deletion:** Active — groups archived in Rock (`IsArchived=true`) are deleted from Webflow and Supabase on next sync; Webflow confirmed to remove deleted items from live site automatically (no `publishSite` call needed after delete)
- **Group images:** Synced — `group-image` field populated in Webflow from Rock RMS `GroupImageThumbnail` attribute

---

## Recent Sessions

### Session 06 (2026-07-29) — Decommission: Remove pipeline, replaced by new sync process

**Goal:** A different sync process now handles Rock RMS → Webflow for Connect Groups. Remove the cron, route, and all Supabase/Webflow group-sync code from this repo.

**Solution:** Deleted `app/api/sync-groups/`, `lib/sync/{index,rock-client,supabase-client,webflow-client,types}.ts`, and their tests (`rock-client.test.ts`, `webflow-client.test.ts`, `sync-utils.test.ts`). Removed `scripts/publish-all-groups.ts`. Trimmed `lib/sync/utils.ts` down to `log`/`logError`, which [[outreach-sync]] still depends on — confirmed via grep that no outreach code imported the removed groups-only helpers. Removed the `sync-groups` cron entry from `vercel.json`, leaving `sync-outreach` in place.

**Verified:** `npx vitest run` — 93/93 tests passing (down from 107; the 14 removed were groups-sync-specific). `npx tsc --noEmit` clean after clearing stale `.next` cache.

**Files Modified:**
- Deleted: `app/api/sync-groups/route.ts`, `app/api/sync-groups/route.test.ts`, `lib/sync/index.ts`, `lib/sync/rock-client.ts`, `lib/sync/supabase-client.ts`, `lib/sync/webflow-client.ts`, `lib/sync/types.ts`, `lib/__tests__/rock-client.test.ts`, `lib/__tests__/webflow-client.test.ts`, `lib/__tests__/sync-utils.test.ts`, `scripts/publish-all-groups.ts`
- `lib/sync/utils.ts` — removed `slugify`, `calculateSpotsAvailable`, `convertTo12Hour`, `parseMultiSelectAttribute`, `getImageUrl`; kept `log`/`logError`
- `vercel.json` — removed `sync-groups` cron entry

**Status:** DECOMMISSIONED — see status note at top of this doc.

---

### Session 05 (2026-06-18) — Change: Use Rock ID as Webflow slug

**Goal:** Replace name-based slug generation with the group's Rock ID so slugs are stable and don't change when a group is renamed.

**Solution:** Changed `slug: slugify(rockGroup.Name)` → `slug: String(rockGroup.Id)` in `transformGroup`. Removed the now-unused `slugify` import. Updated tests to expect `"42"` instead of `"downtown-life-group"` / `"test-group"`.

**Files Modified:**
- `lib/sync/rock-client.ts` — slug now uses `String(rockGroup.Id)`; removed `slugify` import
- `lib/__tests__/rock-client.test.ts` — updated slug assertion
- `lib/__tests__/webflow-client.test.ts` — updated `baseGroup` fixture and assertion

**Status:** VERIFIED WORKING — 107/107 tests passing

---

### Session 04 (2026-05-30) — Feature: Sync group-image to Webflow

**Goal:** Populate the `group-image` Webflow CMS field with the Rock RMS image URL so group images appear in the mobile home carousel.

**Solution:** Added `if (group.group_image) fieldData["group-image"] = group.group_image;` to `transformGroupForWebflow` in `webflow-client.ts`. Webflow Image fields accept a plain URL string and handle fetch/cache server-side.

**Files Modified:**
- `lib/sync/webflow-client.ts` — added `group-image` to `transformGroupForWebflow`
- `lib/__tests__/webflow-client.test.ts` — 2 new tests (image present, image null)
- `docs/Development/groups-sync.md` — added `group-image` row to Webflow field table

**Status:** VERIFIED WORKING

---

### Session 03 (2026-05-30) — Feature: Delete archived groups from Webflow

**Goal:** When a group is archived in Rock RMS (`IsArchived=true`), automatically delete it from Webflow CMS and Supabase on the next sync run.

**Solution:** Added a delete path to the sync pipeline. Rock groups are split into `activeGroups` and `toDelete` (is_archived=true) at the start of `fullSync`. Active groups follow the existing create/update path. Archived groups are removed from Supabase via `deleteGroups()` and from Webflow via `deleteItems()`, reusing the `existingMap` already built in Stage 2 with no extra API calls.

**Verified:** Webflow removes deleted CMS items from the live site automatically — no `publishSite` call needed after deletions.

**Files Modified:**
- `lib/sync/types.ts` — added `IsArchived` to `RockRawGroup`, `is_archived` to `SyncGroup`, `deleted` to `SyncStats`
- `lib/sync/rock-client.ts` — maps `IsArchived ?? false` → `is_archived` in `transformGroup`
- `lib/sync/webflow-client.ts` — added `deleteItem(itemId)` and `deleteItems(itemIds[])`
- `lib/sync/supabase-client.ts` — added `deleteGroups(rockIds[])`
- `lib/sync/index.ts` — wired delete path into `fullSync`
- `lib/__tests__/rock-client.test.ts` — 3 new tests for `is_archived` mapping
- `lib/__tests__/webflow-client.test.ts` — updated `baseGroup` fixture; 5 new tests for delete methods

---

### Session 02 (2026-05-30) — Fix: Webflow update/publish returning 0

**Goal/Problem:** Sync always returned `created: 0, updated: 0, published: 0` for Stage 2 despite token being valid and items existing in both Webflow and Supabase.

**Diagnosis:** Wrote `scripts/diagnose-sync.ts` to cross-reference Webflow items vs Supabase groups locally. Ran `scripts/test-patch.ts` to test a PATCH directly — got `400 Validation Error`:
```json
{"message":"Validation Error","code":"validation_error","details":[
  {"param":"capacity","description":"Field not described in schema: undefined"},
  {"param":"campus-2","description":"Field not described in schema: undefined"}
]}
```

**Root causes:**
1. `transformGroupForWebflow` was sending fields not in the Webflow schema (`campus-2`, `group-type-2`, `meeting-time`, `capacity`, `current-members`, `spots-available`) — every PATCH returned 400, caught silently
2. Audience reference field sent as `group-audiences` but actual Webflow slug is `audience`

**Solution:**
- Removed all non-schema fields from `transformGroupForWebflow` in `lib/sync/webflow-client.ts`
- Fixed `group-audiences` → `audience`
- Removed now-unused `calculateSpotsAvailable` import

**Files Modified:**
- `lib/sync/webflow-client.ts` — removed invalid fields, fixed audience slug
- `lib/__tests__/webflow-client.test.ts` — updated test for removed spots-available field
- `lib/sync/index.ts` — removed temporary debug logging
- `app/api/sync-groups/route.ts` — removed temporary `_debug` field

**Verified:** First successful run after fix: `created: 9, updated: 27, published: 36` ✓

---

### Session 01 (2026-05-29–30) — Implementation & Deployment

**Goal/Problem:** Migrate groups sync from Cloudflare Worker to Next.js + Vercel cron. Fix the bug where synced CMS items stayed as drafts (missing `publishItems` call in old worker).

**Solution:** Implemented full pipeline in `lib/sync/` with TDD. Deployed to Vercel.

**Deployment issues resolved:**
- Route 404 on production: fixed by using `vercel build --prod` + `vercel deploy --prebuilt --prod` (plain `vercel --prod` omitted the route from routing manifest)
- Sensitive env vars not in `vercel env pull`: added manually to `.env.local`
- Existing 36 groups were already in Webflow as drafts: used `scripts/publish-all-groups.ts` one-time script to publish them all

**Files Created:**
- `lib/sync/types.ts`, `utils.ts`, `rock-client.ts`, `supabase-client.ts`, `webflow-client.ts`, `index.ts`
- `app/api/sync-groups/route.ts`
- `lib/__tests__/webflow-client.test.ts`, `rock-client.test.ts`, `utils.test.ts`, `sync-route.test.ts`
- `scripts/publish-all-groups.ts`
- `vercel.json`

**Status:** VERIFIED WORKING (after Session 02 fix)
