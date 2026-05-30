# Groups Sync — Design Spec

**Date:** 2026-05-29
**Status:** Approved

## Overview

Migrate the Rock RMS → Supabase → Webflow CMS groups sync from a Cloudflare Worker into this Next.js app. Fix the Webflow publishing bug where synced items land as drafts and are never promoted to published state.

## Problem

The existing Cloudflare Worker runs a full sync every 6 hours. After creating or updating Webflow CMS items, it calls `publishSite()` (a site build re-deploy). This does not promote draft items to published — items created or updated via the Webflow CMS API land as drafts by default and require a separate Items Publish API call. Groups synced from Rock RMS are therefore never visible on the Webflow-hosted groups page.

A secondary bug: `meetingDaysMap` is referenced in `transformGroupForWebflow` but never initialized, causing silent failures on meeting day mapping. Meeting days are no longer used and will be removed entirely.

## Architecture

Three layers:

1. **`lib/sync/`** — Core sync logic in TypeScript. No framework dependencies. Testable in isolation.
2. **`app/api/sync-groups/route.ts`** — Next.js Route Handler. Entry point for both Vercel Cron and manual triggers.
3. **`vercel.json`** — Cron schedule (every 6 hours).

## File Structure

```
lib/
  sync/
    utils.ts            ← slugify, convertTo12Hour, calculateSpotsAvailable, getDayName, log, logError
    rock-client.ts      ← RockRMSClient: fetchGroups(), fetchGroupDescendants(), transformGroup()
    supabase-client.ts  ← SupabaseClient: upsertGroups(), getAllGroups(), logSync()
    webflow-client.ts   ← WebflowClient: initializeReferenceMaps(), getExistingItems(),
                           transformGroupForWebflow(), createItems(), updateItem(),
                           publishItems(), publishSite()
    index.ts            ← fullSync(env) orchestrator

app/
  api/
    sync-groups/
      route.ts          ← POST (trigger sync) + GET (health check)

vercel.json             ← cron config
```

## Sync Pipeline

```
Rock RMS → Supabase → Webflow CMS → Publish Items → Publish Site
```

**Stage 1 — Rock RMS → Supabase**
- Recursively fetch all descendants of parent group 85
- Filter to Spirit Groups (GroupTypeId === 25)
- Sync all groups regardless of active/public status (status tracked in Webflow)
- Upsert to Supabase `groups` table by `rock_id`

**Stage 2 — Supabase → Webflow**
- Fetch all groups from Supabase
- Fetch existing Webflow items; build `rock_id → item` map
- Diff: groups not in Webflow → create; groups already in Webflow → update
- Collect all created and updated item IDs

**Stage 3 — Publish (the fix)**
- Call `POST /collections/{collectionId}/items/publish` with all affected item IDs
- Call `POST /sites/{siteId}/publish` to trigger a site rebuild

## Publishing Fix Detail

**Current (broken):**
```
create/update items → publishSite()   ← items remain as drafts
```

**Fixed:**
```
create/update items → collect item IDs → publishItems(itemIds) → publishSite()
```

`publishItems()` calls the Webflow v2 endpoint:
```
POST /collections/{collectionId}/items/publish
{ "itemIds": ["id1", "id2", ...] }
```

Item IDs are collected from API responses during create (response body contains the new item ID) and from the existing item map during update (ID already known).

## Removed: Meeting Days

The `meeting-days` reference field, `meetingDaysCollectionId`, and `meetingDaysMap` are removed entirely. The plain text `meeting-time` field is kept.

## API Route

**`POST /api/sync-groups`**
- Protected by `Authorization: Bearer <CRON_SECRET>` header
- Vercel Cron injects this automatically; manual callers must provide it
- Returns `{ success, stats }` on completion or `{ success: false, error }` on failure

**`GET /api/sync-groups`**
- Health check — returns `{ status: "healthy", service, timestamp }`
- Unprotected

## Cron Schedule

```json
{
  "crons": [
    {
      "path": "/api/sync-groups",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Vercel Cron fires every 6 hours, matching the current Cloudflare Worker schedule.

## Environment Variables

| Variable | Source |
|---|---|
| `ROCK_API_URL` | Carry over from Cloudflare |
| `ROCK_REST_KEY` | Carry over from Cloudflare |
| `SUPABASE_URL` | Carry over from Cloudflare |
| `SUPABASE_SERVICE_KEY` | Carry over from Cloudflare |
| `WEBFLOW_API_TOKEN` | Carry over from Cloudflare |
| `WEBFLOW_SITE_ID` | Carry over from Cloudflare |
| `WEBFLOW_COLLECTION_ID` | Carry over from Cloudflare |
| `CRON_SECRET` | New — generate a random secret |

## Out of Scope

- Real-time Rock RMS webhook trigger (Option D) — deferred, can be added later as an additional route
- Admin UI for sync status — logs are available in Vercel dashboard and Supabase `sync_logs` table
- Group image field in Webflow — currently commented out in source, stays commented out
