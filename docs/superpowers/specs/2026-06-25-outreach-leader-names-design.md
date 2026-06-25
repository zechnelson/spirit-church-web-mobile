# Outreach Leader Names & Profile Images — Design Spec

**Date:** 2026-06-25
**Status:** Approved

## Overview

Add two leader name and two leader profile image fields to the Outreach Sync pipeline. On each sync run, fetch GroupMembers with a Leader role from Rock RMS for each Sign-Up Group, and write up to two leaders' names and photo URLs through Supabase into the Webflow `outreach-projects` CMS collection.

The Groups CMS collection already has "Leader Name", "2nd Leader Name", "Leader Profile Image", and "2nd Leader Profile Image" fields in Webflow and corresponding columns in the Supabase `groups` table, but the sync code for groups does not currently populate them. This feature implements the leader fetch pattern for Outreach; the same approach can be backported to Groups later.

Profile images are stored as PlainText URL strings in Webflow (not as Webflow Image type fields) — same pattern as `group-image-3` in the Groups sync. Webflow cannot fetch Rock-hosted image URLs at CMS item creation time; the app reads the URL directly. Photo URLs are constructed from the Person's `Photo.Guid`: `{ROCK_BASE_URL}/GetImage.ashx?guid={guid}`. If a leader has no photo, the image field is `null`.

## Data Flow

```
Rock GroupMembers API (batch, filtered by IsLeader eq true, expanded with Person,GroupRole)
    ↓ fetchLeaderMap(groupIds)
Map<groupId → { name: string; imageUrl: string | null }[]>  (up to 2 entries per group)
    ↓ transformProject()
OutreachProject.leader_name / leader_name_2 / leader_image / leader_image_2
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

Group results by `GroupId`, collect up to 2 leaders per group — each entry is a `{ name: string; imageUrl: string | null }` tuple. Called in `fetchSignUpGroups()` in parallel with the existing IdKey batch fetches (`Promise.all`). Leader map passed into `transformProject()`.

Name format: `(person.NickName || person.FirstName) + " " + person.LastName`

Image URL: `${RMS_BASE_URL}/GetImage.ashx?guid=${person.Photo.Guid}` if `person.Photo?.Guid` is present, otherwise `null`.

If the batch fetch fails (non-ok response), log a warning and return an empty map — all leader fields fall back to `null` gracefully, matching the IdKey batch-fetch error handling pattern.

## Changes by Layer

### 1. Types — `lib/sync/outreach/types.ts`

Add to `OutreachProject`:
- `leader_name: string | null`
- `leader_name_2: string | null`
- `leader_image: string | null`
- `leader_image_2: string | null`

New interface:
```ts
interface RockRawGroupMember {
  GroupId: number;
  Person?: {
    FirstName: string;
    NickName?: string | null;
    LastName: string;
    Photo?: { Guid?: string | null } | null;
  };
  GroupRole?: {
    IsLeader: boolean;
  };
}
```

### 2. Rock Client — `lib/sync/outreach/rock-client.ts`

New private method:
```ts
private async fetchLeaderMap(
  groupIds: number[]
): Promise<Map<number, { name: string; imageUrl: string | null }[]>>
```

- Builds `$filter` with `GroupId eq X or ...` combined with `and GroupRole/IsLeader eq true`
- Expands `Person,GroupRole`
- Iterates response; for each member with a valid Person:
  - Formats name as `(NickName || FirstName) + " " + LastName`
  - Constructs imageUrl as `${RMS_BASE_URL}/GetImage.ashx?guid=${Photo.Guid}` if Guid is present, otherwise `null`
  - Appends `{ name, imageUrl }` to that GroupId's array, up to 2 entries
- On non-ok response: logs warning, returns empty `Map` (same pattern as `fetchIdKeyMap`)
- On empty `groupIds`: returns empty `Map` immediately

In `fetchSignUpGroups()`:
- Add `fetchLeaderMap(groupIds)` to the existing `Promise.all` alongside the three IdKey fetches
- Pass resulting map into each `transformProject()` call

In `transformProject()`:
- Add optional `leaderMap?: Map<number, { name: string; imageUrl: string | null }[]>` parameter
- Set `leader_name: leaderMap?.get(rawGroup.Id)?.[0]?.name ?? null`
- Set `leader_name_2: leaderMap?.get(rawGroup.Id)?.[1]?.name ?? null`
- Set `leader_image: leaderMap?.get(rawGroup.Id)?.[0]?.imageUrl ?? null`
- Set `leader_image_2: leaderMap?.get(rawGroup.Id)?.[1]?.imageUrl ?? null`

### 3. Supabase — `outreach_projects` table

Add four nullable TEXT columns via Supabase dashboard:
- `leader_name TEXT`
- `leader_name_2 TEXT`
- `leader_image TEXT`
- `leader_image_2 TEXT`

No code changes to `supabase-client.ts` — the upsert already spreads the full `OutreachProject` object, so new fields are written automatically once they exist on the type and in the table.

### 4. Webflow Collection — `outreach-projects`

Manually add four PlainText fields to the `outreach-projects` collection (`6a28cbac65cb0f0593f53802`) via Webflow MCP or Designer:
- "Leader Name" → expected slug: `leader-name`
- "2nd Leader Name" → expected slug: `leader-name-2`
- "Leader Profile Image" → expected slug: `leader-profile-image`
- "2nd Leader Profile Image" → expected slug: `leader-profile-image-2`

All four are PlainText (not Webflow Image type) — same pattern as `group-image-3` in the Groups sync. The app reads the URL string directly; Webflow does not need to fetch the image.

Confirm all slugs after creation — Webflow may assign numeric suffixes if same-named fields previously existed.

In `lib/sync/outreach/webflow-client.ts`, add to `transformProjectForWebflow()`:
```ts
if (project.leader_name) fieldData["leader-name"] = project.leader_name;
if (project.leader_name_2) fieldData["leader-name-2"] = project.leader_name_2;
if (project.leader_image) fieldData["leader-profile-image"] = project.leader_image;
if (project.leader_image_2) fieldData["leader-profile-image-2"] = project.leader_image_2;
```

Field slug keys must be confirmed against actual Webflow slugs after the fields are created.

### 5. Tests

**`lib/__tests__/outreach-rock-client.test.ts`** — new tests:
- `fetchLeaderMap`: happy path returns correct map with name and imageUrl for both leaders
- `fetchLeaderMap`: more than 2 leaders → only first 2 are kept
- `fetchLeaderMap`: non-ok response → logs warning, returns empty map
- `fetchLeaderMap`: empty groupIds → returns empty map without fetching
- `fetchLeaderMap`: leader with no Photo.Guid → imageUrl is null
- `transformProject`: with leader map populated → sets all four leader fields
- `transformProject`: with empty leader map → all four fields are `null`
- `transformProject`: NickName present → uses NickName over FirstName
- `transformProject`: NickName absent → falls back to FirstName

**`lib/__tests__/outreach-webflow-client.test.ts`** — new/updated tests:
- `transformProjectForWebflow`: all four leader fields present → all included in fieldData
- `transformProjectForWebflow`: leader fields null → all four omitted from fieldData
- `transformProjectForWebflow`: leader image null but name present → name included, image omitted

## Error Handling

- Batch fetch failure: empty map returned, warning logged. All four leader fields will be `null` for all projects on that sync run. Does not throw or abort the sync.
- Missing Person data on a GroupMember: skip that member, don't add to the map.
- NickName is empty string: treat as absent, fall back to FirstName.
- Missing or null `Photo.Guid`: `imageUrl` is `null` for that leader; name is still written if present.

## Out of Scope

- Backporting leader fetch to the Groups sync (separate task)
- Handling more than 2 leaders per group
