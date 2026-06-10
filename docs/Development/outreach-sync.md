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

| Collection | Slug | Purpose |
| ---------- | ---- | ------- |
| Outreach Projects | `outreach-projects` | Main collection — one item per opportunity |
| Outreach Campus | `outreach-campus` | Campus single-ref filter |
| Outreach Events | `outreach-events` | Event single-ref filter |
| Outreach Categories | `outreach-categories` | Category single-ref filter |
| Outreach Cities | `outreach-cities` | City single-ref filter |

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
| `campus` | Ref → outreach-campus | campusMap lookup by name |
| `event` | Ref → outreach-events | eventMap lookup by name |
| `category` | Ref → outreach-categories | categoryMap lookup by name |
| `city` | Ref → outreach-cities | cityMap lookup by name |

## Environment Variables

| Variable | Notes |
| -------- | ----- |
| `ROCK_SIGNUP_GROUP_TYPE_ID` | GroupType ID for Sign-Up Groups in Rock |
| `WEBFLOW_OUTREACH_COLLECTION_ID` | Main outreach-projects collection ID |
| `WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID` | Reference collection |
| `WEBFLOW_OUTREACH_EVENT_COLLECTION_ID` | Reference collection |
| `WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID` | Reference collection |
| `WEBFLOW_OUTREACH_CITY_COLLECTION_ID` | Reference collection |

Reuses: `CRON_SECRET`, `ROCK_API_URL`, `ROCK_REST_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WEBFLOW_API_TOKEN`, `WEBFLOW_SITE_ID`

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

## Rock Attribute Keys (Unverified)

The following attribute key names in `rock-client.ts` are **guesses** — confirm against a live Rock API response before the first sync:

`Semester`, `Event`, `Category`, `KidsWelcome`, `HandicapAccessible`, `ToolsSuppliesNeeded`, `ProjectType`

Run to verify:
```bash
curl -s "https://rms.spiritchurch.co/api/Groups?$filter=GroupTypeId%20eq%20<ID>&$top=1&loadAttributes=simple" \
  -H "Authorization-Token: <ROCK_REST_KEY>" | jq '.[] | .AttributeValues | keys'
```

## Current Status

- **Code:** Complete — 112/112 tests passing (Tasks 1–6 done, committed to main)
- **Cron:** Added to `vercel.json` (commit `3595df0`) — not yet deployed
- **Supabase table:** Created
- **Webflow collections:** Not yet created (needs Spirit Church Webflow account access)
- **Vercel env vars:** Not yet added
- **Deployment:** Pending Task 0 completion

---

## Recent Sessions

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
1. Create 5 Webflow collections in Spirit Church Webflow account (see field table above)
2. Add 6 env vars to Vercel (ROCK_SIGNUP_GROUP_TYPE_ID + 5 Webflow collection IDs)
3. Pull env locally: `vercel env pull --environment production .env.local`
4. Verify Rock attribute key names via diagnostic curl
5. Deploy: `vercel build --prod && vercel deploy --prebuilt --prod`
6. Trigger manual sync and verify end-to-end
