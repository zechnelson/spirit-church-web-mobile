# Outreach Available Spots — Design Spec

**Date:** 2026-06-27
**Workstream:** Outreach Sync
**Status:** Approved

## Context

Each Rock RMS Sign-Up Group opportunity has a `MaximumCapacity` (always set for Spirit Church projects) and a running count of sign-up assignments. This feature syncs `spots_available` and `is_full` to Webflow so the outreach page can display remaining capacity. Numbers are snapshotted at sync time (6-hour cron) — no live updates.

## Data Source (Rock RMS)

**Capacity:** `GroupLocationScheduleConfigs` — added to the existing `$expand` on the main Groups fetch. Each config is matched to its opportunity by `GroupLocationId` and `ScheduleId`. The relevant field is `MaximumCapacity` (INTEGER, nullable; always set for active projects).

**Filled count:** `GroupMemberAssignments` endpoint — new batch fetch `fetchAssignmentCountMap(groupIds)`, same chunked pattern as `fetchLeaderMap` (15 IDs per request to stay under Rock's OData node limit). Query uses `$select=GroupId,LocationId,ScheduleId` to minimize payload. Builds a `Map<string, number>` keyed as `"${groupId}|${locationId}|${scheduleId}"`.

## Computed Fields

In `transformProject`:

```
spotsAvailable = MaximumCapacity != null
  ? Math.max(0, MaximumCapacity - filledCount)
  : null

isFull = MaximumCapacity != null && filledCount >= MaximumCapacity
```

- If `MaximumCapacity` is null: `spots_available = null`, `is_full = false`
- If over-subscribed (admin override, manual entry): clamp to 0, mark full
- If assignment fetch fails: log warning, return empty map — sync continues with `spots_available = null`, `is_full = false`

## Supabase

Two new columns on `outreach_projects`:

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `spots_available` | INTEGER | YES | — |
| `is_full` | BOOLEAN | NO | false |

Added manually in Supabase dashboard. Schema cache must be reloaded after adding (Project Settings → API → Reload schema cache) before running sync. Both columns spread automatically into the existing upsert payload.

## Webflow

Two new fields on the `outreach-projects` collection (added manually via Webflow dashboard):

| Field slug | Type | Notes |
|------------|------|-------|
| `spots-available` | Number | Written conditionally (only when not null) |
| `is-full` | Switch | Always written |

## Files Modified

| File | Change |
|------|--------|
| `lib/sync/outreach/types.ts` | Add `GroupLocationScheduleConfigs` to `RockOpportunityLocation`; add `spots_available` and `is_full` to `OutreachProject` |
| `lib/sync/outreach/rock-client.ts` | Add `GroupLocations/GroupLocationScheduleConfigs` to `$expand`; add `fetchAssignmentCountMap`; update `transformProject` and `fetchSignUpGroups` signature |
| `lib/sync/outreach/webflow-client.ts` | Add `spots-available` and `is-full` to `transformProjectForWebflow` |
| `lib/__tests__/outreach-rock-client.test.ts` | New tests for `fetchAssignmentCountMap`; update `transformProject` fixture and assertions |
| `lib/__tests__/outreach-webflow-client.test.ts` | Update `baseProject` fixture; new tests for both fields |

No changes to `supabase-client.ts`, `index.ts`, or the route handler.

## Verification

1. Run `npx vitest run` — all tests pass
2. Add Supabase columns + reload schema cache
3. Add Webflow fields
4. Trigger manual sync: `curl -X POST https://app.spiritchurch.co/api/sync-outreach -H "Authorization: Bearer <CRON_SECRET>"`
5. Check Supabase `outreach_projects` table — `spots_available` and `is_full` populated
6. Check Webflow CMS — both fields present on outreach items
