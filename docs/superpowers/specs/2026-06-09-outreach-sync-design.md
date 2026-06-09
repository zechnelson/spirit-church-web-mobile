# Outreach Projects Sync — Design Spec

**Date:** 2026-06-09
**Status:** Approved
**Workstream:** Outreach Sync (new)

---

## Overview

Automated pipeline that syncs Outreach Projects from Rock RMS → Supabase → Webflow CMS on a 6-hour cron schedule. Mirrors the existing Groups Sync pipeline in architecture, code organization, and error handling patterns.

Users browse Outreach Projects on a Webflow page, filter by Location (City), Campus, Event, and Category, and click a sign-up button that deep-links to the Rock RMS opportunity registration form.

---

## Architecture

```
Rock RMS REST API (Sign-Up Groups + Opportunities)
    ↓  rock-client.ts
Supabase `outreach_projects` table  ← upsert by rock_opportunity_id
    ↓  supabase-client.ts
Webflow CMS `outreach-projects` collection
    ↓  create + PATCH (webflow-client.ts)
    ↓  publishItems → publishSite
```

Independent pipeline from Groups Sync. Separate cron endpoint, orchestrator, and client files. Shares `CRON_SECRET`, `ROCK_API_URL`, `ROCK_REST_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `WEBFLOW_API_TOKEN` with Groups Sync.

---

## Rock RMS Data Model

Sign-Up Groups are Rock Groups with `GroupTypeId = ROCK_SIGNUP_GROUP_TYPE_ID`. Each group has one or more Opportunities, which are `GroupLocation` records with associated `Schedule` entries.

**Group-level fields:**
- Project Name, Description, Active, IsArchived
- Campus, Semester, Event, Category (custom attributes)
- Kids Welcome, Handicap Accessible (boolean attributes)
- Tools/Supplies Needed (text attribute)
- Project Type: "In-Person" or "Project Due"

**Opportunity-level fields (GroupLocation + Schedule):**
- Schedule date/time (e.g., "Once at 7/11/2026 9:00 AM")
- Location address
- Sign-up URL — constructed from obfuscated IdKeys:
  `/signups/register/{group.IdKey}/location/{groupLocation.IdKey}/schedule/{schedule.IdKey}`

**Starting assumption:** One opportunity per group. The data model supports expansion to multiple opportunities later without schema changes (dedup key is `rock_opportunity_id`, not `rock_group_id`).

**IdKey discovery:** Rock's REST API typically returns `IdKey` on entities. If `GroupLocation` or `Schedule` entities do not include `IdKey`, fall back to `GET /api/Utilities/GetIdKey/{id}` per entity. If IdKeys cannot be resolved for a project, log the error and skip that item — do not fail the entire sync.

---

## Supabase Table: `outreach_projects`

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | — |
| `rock_group_id` | INTEGER | Group.Id |
| `rock_opportunity_id` | INTEGER UNIQUE | GroupLocation.Id — dedup key |
| `rock_schedule_id` | INTEGER | Schedule.Id |
| `name` | TEXT NOT NULL | Group.Name |
| `slug` | TEXT UNIQUE NOT NULL | generated from name |
| `description` | TEXT | Group.Description |
| `schedule_display` | TEXT | human-readable date/time string |
| `schedule_datetime` | TIMESTAMPTZ | parsed datetime for sorting |
| `location_address` | TEXT | full street address |
| `city` | TEXT | parsed from address |
| `campus` | TEXT | Group.Campus.Name |
| `semester` | TEXT | Group.Semester attribute |
| `event` | TEXT | Group.Event attribute |
| `category` | TEXT | Group.Category attribute |
| `kids_welcome` | BOOLEAN | Group.KidsWelcome attribute |
| `handicap_accessible` | BOOLEAN | Group.HandicapAccessible attribute |
| `tools_needed` | TEXT | Group.ToolsSuppliesNeeded attribute |
| `project_type` | TEXT | "In-Person" or "Project Due" |
| `signup_url` | TEXT | constructed from IdKeys |
| `is_active` | BOOLEAN | Group.IsActive |
| `is_archived` | BOOLEAN | Group.IsArchived |
| `webflow_item_id` | TEXT | Webflow CMS item ID |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() |

---

## Webflow CMS

### Main Collection: `outreach-projects`

| Field slug | Type | Source |
|---|---|---|
| `name` | PlainText | `project.name` |
| `slug` | PlainText | generated |
| `rock-group-id` | Number | `project.rock_group_id` |
| `rock-opportunity-id` | Number | `project.rock_opportunity_id` |
| `description` | RichText | `project.description` |
| `schedule-display` | PlainText | `project.schedule_display` |
| `location-address` | PlainText | `project.location_address` |
| `semester` | PlainText | `project.semester` |
| `kids-welcome` | Switch | `project.kids_welcome` |
| `handicap-accessible` | Switch | `project.handicap_accessible` |
| `tools-needed` | PlainText | `project.tools_needed` |
| `project-type` | PlainText | `project.project_type` |
| `signup-url` | Link | `project.signup_url` |
| `is-active` | Switch | `project.is_active` |
| `campus` | Ref → outreach-campus | campusMap lookup by name |
| `event` | Ref → outreach-events | eventMap lookup by name |
| `category` | Ref → outreach-categories | categoryMap lookup by name |
| `city` | Ref → outreach-cities | cityMap lookup by name |

### Reference Collections (new, populated manually in Webflow before first sync)

| Collection | Slug | Purpose |
|---|---|---|
| Outreach Campus | `outreach-campus` | Campus single-ref filter |
| Outreach Events | `outreach-events` | Event single-ref filter |
| Outreach Categories | `outreach-categories` | Category single-ref filter |
| Outreach Cities | `outreach-cities` | City single-ref filter |

Reference maps are loaded by name at runtime (same pattern as Groups Sync). Unmatched values are logged and the field is omitted from that item's payload — the sync does not fail.

---

## Sync Pipeline

### Stage 1: Rock → Supabase

1. Fetch all Sign-Up Groups from Rock: `GET /api/Groups?$filter=GroupTypeId eq {ROCK_SIGNUP_GROUP_TYPE_ID}&$expand=GroupLocations($expand=Location,Schedules),Campus,GroupAttributes` — exact attribute key names for Campus, Semester, Event, Category, Kids Welcome, Handicap Accessible, Tools Needed, and Project Type are custom Rock attributes; confirm names against live API response during implementation
2. For each group, take the first GroupLocation as the primary opportunity
3. Construct sign-up URL from group, location, and schedule IdKeys
4. Split results: `active` (IsArchived=false) and `toDelete` (IsArchived=true)
5. Upsert active projects to `outreach_projects` by `rock_opportunity_id`

### Stage 2: Supabase → Webflow

1. Query all `outreach_projects` from Supabase
2. Fetch existing Webflow items; build `existingMap` keyed by `rock-opportunity-id`
3. Load reference collection maps (Campus, Event, Category, City) by name
4. For each project: create (POST) if not in existingMap, update (PATCH) if present
5. For each archived ID: delete from Webflow (using existingMap) and Supabase
6. Track created/updated item IDs for publishing

### Stage 3: Publish

`publishItems` in chunks of 100, then `publishSite`. Deletions do not require `publishSite` — Webflow removes deleted items from the live site automatically.

---

## Active/Archived Handling

| Rock State | Action |
|---|---|
| `IsActive=false`, `IsArchived=false` | Sync `is-active: false` to Webflow. Item stays in CMS but filtered out on the public page. Reversible on next sync if reactivated. |
| `IsArchived=true` | Hard delete from Webflow CMS and Supabase. Irreversible. |

---

## Code Organization

```
lib/sync/outreach/
├── index.ts             -- fullOutreachSync() orchestrator
├── rock-client.ts       -- fetch Sign-Up Groups + Opportunities from Rock
├── supabase-client.ts   -- upsert/query/delete outreach_projects
├── webflow-client.ts    -- create/update/delete/publish Webflow items
├── types.ts             -- OutreachProject, RockSignUpGroup, OutreachSyncStats, etc.
└── utils.ts             -- slug generation, logging (imports from ../utils where applicable)

app/api/sync-outreach/route.ts   -- GET (cron) + POST (manual), validates CRON_SECRET

lib/__tests__/
├── outreach-rock-client.test.ts    -- Rock response mapping, IsArchived, IdKey → sign-up URL
├── outreach-webflow-client.test.ts -- transform logic, reference map lookups, delete methods
└── outreach-sync-route.test.ts     -- CRON_SECRET auth, GET/POST, stats response shape
```

---

## Environment Variables

| Variable | Notes |
|---|---|
| `ROCK_SIGNUP_GROUP_TYPE_ID` | GroupType ID for Sign-Up Groups in Rock |
| `WEBFLOW_OUTREACH_COLLECTION_ID` | Main outreach-projects collection ID |
| `WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID` | Reference collection |
| `WEBFLOW_OUTREACH_EVENT_COLLECTION_ID` | Reference collection |
| `WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID` | Reference collection |
| `WEBFLOW_OUTREACH_CITY_COLLECTION_ID` | Reference collection |

All added to Vercel env (non-sensitive). Reuses `CRON_SECRET`, `ROCK_API_URL`, `ROCK_REST_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WEBFLOW_API_TOKEN`, and `WEBFLOW_SITE_ID` from existing Groups Sync config.

---

## Error Handling

Each stage returns a stats object with a `status` field (`"success"` or `"error"`). Stage failures are logged and included in the JSON response but do not crash other stages. The route returns HTTP 200 with the full stats payload so Vercel cron does not retry on partial failures.

---

## Vercel Cron

Add to `vercel.json`:
```json
{ "path": "/api/sync-outreach", "schedule": "0 */6 * * *" }
```

---

## Manual Trigger

```bash
curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-outreach \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

## Out of Scope

- Multi-opportunity per group (future: add `outreach_opportunities` table, update sync to emit one Webflow item per opportunity)
- Attendance tracking (spots available, sign-up count)
- Reminder Details / Confirmation Details fields (admin-only content)
- Image support (no image field observed on Sign-Up Groups)
