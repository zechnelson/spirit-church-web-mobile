# Outreach Leader Names — Design Spec

**Date:** 2026-06-25
**Status:** Approved

## Overview

Add two leader name fields to the Outreach Sync pipeline. On each sync run, fetch GroupMembers with a Leader role from Rock RMS for each Sign-Up Group, and write up to two leader names through Supabase into the Webflow `outreach-projects` CMS collection.

The Groups CMS collection already has "Leader Name" and "2nd Leader Name" fields in Webflow and corresponding columns in the Supabase `groups` table, but the sync code for groups does not currently populate them. This feature implements the leader fetch pattern for Outreach; the same approach can be backported to Groups later.

## Data Flow

```
Rock GroupMembers API (batch, filtered by IsLeader eq true)
    ↓ fetchLeaderMap(groupIds)
Map<groupId → string[]>  (up to 2 names per group)
    ↓ transformProject()
OutreachProject.leader_name / leader_name_2
    ↓ Supabase outreach_projects (upsert — existing spread handles new columns)
    ↓ Webflow outreach-projects (transformProjectForWebflow)
```

## Approach

**Option A — Batch GroupMembers fetch** (chosen)

After the main Sign-Up Groups fetch, run one additional Rock API call:

```
GET /api/GroupMembers
  ?$filter=(GroupId eq X or GroupId eq Y or ...) and GroupRole/IsLeader eq true
  &$expand=Person,GroupRole
```

Group results by `GroupId`, collect up to 2 leader names per group. Called in `fetchSignUpGroups()` in parallel with the existing IdKey batch fetches (`Promise.all`). Leader map passed into `transformProject()`.

Name format: `(person.NickName || person.FirstName) + " " + person.LastName`

If the batch fetch fails (non-ok response), log a warning and return an empty map — leader names fall back to `null` gracefully, matching the IdKey batch-fetch error handling pattern.

## Changes by Layer

### 1. Types — `lib/sync/outreach/types.ts`

Add to `OutreachProject`:
- `leader_name: string | null`
- `leader_name_2: string | null`

New interface:
```ts
interface RockRawGroupMember {
  GroupId: number;
  Person?: {
    FirstName: string;
    NickName?: string | null;
    LastName: string;
  };
  GroupRole?: {
    IsLeader: boolean;
  };
}
```

### 2. Rock Client — `lib/sync/outreach/rock-client.ts`

New private method:
```ts
private async fetchLeaderMap(groupIds: number[]): Promise<Map<number, string[]>>
```

- Builds `$filter` with `GroupId eq X or ...` combined with `and GroupRole/IsLeader eq true`
- Expands `Person,GroupRole`
- Iterates response, formats each name as `(NickName || FirstName) + " " + LastName`
- Accumulates up to 2 names per `GroupId` in a `Map<number, string[]>`
- On non-ok response: logs warning, returns empty `Map` (same pattern as `fetchIdKeyMap`)
- On empty `groupIds`: returns empty `Map` immediately

In `fetchSignUpGroups()`:
- Add `fetchLeaderMap(groupIds)` to the existing `Promise.all` alongside the three IdKey fetches
- Pass resulting map into each `transformProject()` call

In `transformProject()`:
- Add optional `leaderMap?: Map<number, string[]>` parameter
- Set `leader_name: leaderMap?.get(rawGroup.Id)?.[0] ?? null`
- Set `leader_name_2: leaderMap?.get(rawGroup.Id)?.[1] ?? null`

### 3. Supabase — `outreach_projects` table

Add two nullable TEXT columns via Supabase dashboard:
- `leader_name TEXT`
- `leader_name_2 TEXT`

No code changes to `supabase-client.ts` — the upsert already spreads the full `OutreachProject` object, so new fields are written automatically once they exist on the type and in the table.

### 4. Webflow Collection — `outreach-projects`

Manually add two PlainText fields to the `outreach-projects` collection (`6a28cbac65cb0f0593f53802`) via Webflow MCP or Designer:
- "Leader Name" → expected slug: `leader-name`
- "2nd Leader Name" → expected slug: `leader-name-2` (confirm after creation — Webflow may assign a different suffix)

In `lib/sync/outreach/webflow-client.ts`, add to `transformProjectForWebflow()`:
```ts
if (project.leader_name) fieldData["leader-name"] = project.leader_name;
if (project.leader_name_2) fieldData["leader-name-2"] = project.leader_name_2;
```

Field slug keys must be confirmed against actual Webflow slugs after the fields are created.

### 5. Tests

**`lib/__tests__/outreach-rock-client.test.ts`** — new tests:
- `fetchLeaderMap`: happy path returns correct map (first and second leader per group)
- `fetchLeaderMap`: more than 2 leaders → only first 2 are kept
- `fetchLeaderMap`: non-ok response → logs warning, returns empty map
- `fetchLeaderMap`: empty groupIds → returns empty map without fetching
- `transformProject`: with leader map populated → sets `leader_name` and `leader_name_2`
- `transformProject`: with empty leader map → both fields are `null`
- `transformProject`: NickName present → uses NickName over FirstName
- `transformProject`: NickName absent → falls back to FirstName

**`lib/__tests__/outreach-webflow-client.test.ts`** — new/updated tests:
- `transformProjectForWebflow`: leader names present → both fields included in fieldData
- `transformProjectForWebflow`: leader names null → fields omitted from fieldData

## Error Handling

- Batch fetch failure: empty map returned, warning logged. `leader_name` and `leader_name_2` will be `null` for all projects on that sync run. Does not throw or abort the sync.
- Missing Person data on a GroupMember: skip that member, don't add to the map.
- NickName is empty string: treat as absent, fall back to FirstName.

## Out of Scope

- Leader profile images (separate feature if needed)
- Backporting leader fetch to the Groups sync (separate task)
- Handling more than 2 leaders per group
