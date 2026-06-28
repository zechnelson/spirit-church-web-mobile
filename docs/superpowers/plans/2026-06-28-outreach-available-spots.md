# Outreach Available Spots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync `spots_available` (int) and `is_full` (bool) for each outreach project from Rock RMS into Supabase and Webflow, snapshotted at each 6-hour cron run.

**Architecture:** Add `GroupLocations/GroupLocationScheduleConfigs` to the existing Groups expand to get `MaximumCapacity` without an extra API call. Add a new `fetchAssignmentCountMap` batch method (same chunked pattern as `fetchLeaderMap`) to count filled sign-ups via `GroupMemberAssignments`. Compute available = max − filled in `transformProject`. Push two new fields through Supabase and into Webflow.

**Tech Stack:** TypeScript, Next.js App Router, Rock RMS REST/OData API, Supabase (raw fetch), Webflow CMS API v2, Vitest

## Global Constraints

- Rock OData node limit: chunk all batch filters at 15 IDs per request (`Id eq X or ...` = ~3 nodes each)
- All new fields nullable-safe: if `MaximumCapacity` is null, `spots_available = null` and `is_full = false`
- Over-subscribed clamp: if filled > max, `spots_available = 0` and `is_full = true`
- Fetch failures degrade gracefully: log warning, return empty map, sync continues
- TDD: write failing tests first, then implement

---

## File Map

| File | Change |
|------|--------|
| `lib/sync/outreach/types.ts` | Add `GroupLocationScheduleConfig` interface; add to `RockOpportunityLocation`; add `spots_available`/`is_full` to `OutreachProject` |
| `lib/sync/outreach/rock-client.ts` | Extend `$expand`; add `fetchAssignmentCountMap`; add param to `transformProject`; wire into `fetchSignUpGroups` |
| `lib/sync/outreach/webflow-client.ts` | Write `spots-available` and `is-full` in `transformProjectForWebflow` |
| `lib/__tests__/outreach-rock-client.test.ts` | New `fetchAssignmentCountMap` tests; new `transformProject` spots tests |
| `lib/__tests__/outreach-webflow-client.test.ts` | Update `baseProject` fixture; new field tests |

No changes to `supabase-client.ts`, `index.ts`, or the route handler.

---

## Task 1: Update types

**Files:**
- Modify: `lib/sync/outreach/types.ts`

**Interfaces:**
- Produces: `GroupLocationScheduleConfig` (used by Task 2); `spots_available: number | null` and `is_full: boolean` on `OutreachProject` (used by Tasks 2 and 3)

- [ ] **Step 1: Add `GroupLocationScheduleConfig` interface and extend `RockOpportunityLocation`**

Open `lib/sync/outreach/types.ts`. Add the new interface and field immediately after the `RockSchedule` interface (before `RockOpportunityLocation`):

```typescript
export interface GroupLocationScheduleConfig {
  GroupLocationId: number;
  ScheduleId: number;
  MinimumCapacity: number | null;
  DesiredCapacity: number | null;
  MaximumCapacity: number | null;
}
```

Then add `GroupLocationScheduleConfigs` to `RockOpportunityLocation`:

```typescript
export interface RockOpportunityLocation {
  Id: number;
  IdKey?: string;
  Location?: {
    Id?: number;
    IdKey?: string;
    Street1?: string;
    City?: string;
    State?: string;
    PostalCode?: string;
    FormattedAddress?: string;
  };
  Schedules?: RockSchedule[];
  GroupLocationScheduleConfigs?: GroupLocationScheduleConfig[];
}
```

- [ ] **Step 2: Add `spots_available` and `is_full` to `OutreachProject`**

In `lib/sync/outreach/types.ts`, add two fields to `OutreachProject` after `signup_url`:

```typescript
  signup_url: string | null;
  spots_available: number | null;
  is_full: boolean;
  is_active: boolean;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (existing code will have type errors on `OutreachProject` until Tasks 2 and 3 fill the new fields — that's fine, we fix them there).

- [ ] **Step 4: Commit**

```bash
git add lib/sync/outreach/types.ts
git commit -m "feat(outreach-sync): add spots_available and is_full to types"
```

---

## Task 2: Add `fetchAssignmentCountMap` and update `transformProject`

**Files:**
- Modify: `lib/sync/outreach/rock-client.ts`
- Test: `lib/__tests__/outreach-rock-client.test.ts`

**Interfaces:**
- Consumes: `GroupLocationScheduleConfig` from Task 1; existing `fetchIdKeyMap`, `fetchLeaderMap` chunking pattern
- Produces: `fetchAssignmentCountMap(groupIds: number[]): Promise<Map<string, number>>` — key format `"${groupId}|${locationId}|${scheduleId}"`; updated `transformProject` signature with 6th param `assignmentCountMap?: Map<string, number>`; `spots_available` and `is_full` on returned `OutreachProject`

- [ ] **Step 1: Write failing tests for `fetchAssignmentCountMap`**

Add a new `describe("fetchAssignmentCountMap", ...)` block at the end of `lib/__tests__/outreach-rock-client.test.ts`:

```typescript
describe("fetchAssignmentCountMap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds count map keyed by groupId|locationId|scheduleId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { GroupId: 100, LocationId: 201, ScheduleId: 300 },
        { GroupId: 100, LocationId: 201, ScheduleId: 300 },
        { GroupId: 101, LocationId: 202, ScheduleId: 301 },
      ]),
    }));
    const map = await (client as any).fetchAssignmentCountMap([100, 101]);
    expect(map.get("100|201|300")).toBe(2);
    expect(map.get("101|202|301")).toBe(1);
  });

  it("returns empty map without fetching when groupIds is empty", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    const map = await (client as any).fetchAssignmentCountMap([]);
    expect(map.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty map and does not throw on failed fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    const map = await (client as any).fetchAssignmentCountMap([100]);
    expect(map.size).toBe(0);
  });

  it("sends two requests when groupIds exceeds chunk size of 15", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    await (client as any).fetchAssignmentCountMap(ids);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("merges results across chunks", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { GroupId: 1, LocationId: 10, ScheduleId: 100 },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          { GroupId: 16, LocationId: 20, ScheduleId: 200 },
        ]),
      })
    );
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    const map = await (client as any).fetchAssignmentCountMap(ids);
    expect(map.get("1|10|100")).toBe(1);
    expect(map.get("16|20|200")).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/__tests__/outreach-rock-client.test.ts
```

Expected: 5 new test failures mentioning `fetchAssignmentCountMap is not a function`.

- [ ] **Step 3: Write failing tests for the updated `transformProject` capacity fields**

Add these tests inside the existing `describe("transformProject", ...)` block in `lib/__tests__/outreach-rock-client.test.ts`:

```typescript
  it("computes spots_available and is_full from assignment count map", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [{
        ...baseRaw.GroupLocations![0],
        GroupLocationScheduleConfigs: [
          { GroupLocationId: 200, ScheduleId: 300, MinimumCapacity: null, DesiredCapacity: null, MaximumCapacity: 10 },
        ],
      }],
    };
    const assignmentCountMap = new Map([["100|201|300", 3]]);
    const result = client.transformProject(raw, undefined, undefined, undefined, undefined, assignmentCountMap);
    expect(result!.spots_available).toBe(7);
    expect(result!.is_full).toBe(false);
  });

  it("sets is_full true when assignment count equals MaximumCapacity", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [{
        ...baseRaw.GroupLocations![0],
        GroupLocationScheduleConfigs: [
          { GroupLocationId: 200, ScheduleId: 300, MinimumCapacity: null, DesiredCapacity: null, MaximumCapacity: 3 },
        ],
      }],
    };
    const assignmentCountMap = new Map([["100|201|300", 3]]);
    const result = client.transformProject(raw, undefined, undefined, undefined, undefined, assignmentCountMap);
    expect(result!.spots_available).toBe(0);
    expect(result!.is_full).toBe(true);
  });

  it("clamps spots_available to 0 and sets is_full when over-subscribed", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [{
        ...baseRaw.GroupLocations![0],
        GroupLocationScheduleConfigs: [
          { GroupLocationId: 200, ScheduleId: 300, MinimumCapacity: null, DesiredCapacity: null, MaximumCapacity: 3 },
        ],
      }],
    };
    const assignmentCountMap = new Map([["100|201|300", 5]]);
    const result = client.transformProject(raw, undefined, undefined, undefined, undefined, assignmentCountMap);
    expect(result!.spots_available).toBe(0);
    expect(result!.is_full).toBe(true);
  });

  it("returns null spots_available and false is_full when MaximumCapacity is null", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [{
        ...baseRaw.GroupLocations![0],
        GroupLocationScheduleConfigs: [
          { GroupLocationId: 200, ScheduleId: 300, MinimumCapacity: null, DesiredCapacity: null, MaximumCapacity: null },
        ],
      }],
    };
    const assignmentCountMap = new Map([["100|201|300", 3]]);
    const result = client.transformProject(raw, undefined, undefined, undefined, undefined, assignmentCountMap);
    expect(result!.spots_available).toBeNull();
    expect(result!.is_full).toBe(false);
  });

  it("returns null spots_available and false is_full when no GroupLocationScheduleConfigs", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.spots_available).toBeNull();
    expect(result!.is_full).toBe(false);
  });

  it("returns 0 filled count (full available) when group has no assignments in map", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [{
        ...baseRaw.GroupLocations![0],
        GroupLocationScheduleConfigs: [
          { GroupLocationId: 200, ScheduleId: 300, MinimumCapacity: null, DesiredCapacity: null, MaximumCapacity: 8 },
        ],
      }],
    };
    const result = client.transformProject(raw, undefined, undefined, undefined, undefined, new Map());
    expect(result!.spots_available).toBe(8);
    expect(result!.is_full).toBe(false);
  });
```

- [ ] **Step 4: Run tests to confirm new transformProject tests fail**

```bash
npx vitest run lib/__tests__/outreach-rock-client.test.ts
```

Expected: 6 additional failures — existing tests still pass, new capacity tests fail.

- [ ] **Step 5: Implement `fetchAssignmentCountMap`**

Add the following private method to `OutreachRockClient` in `lib/sync/outreach/rock-client.ts`, directly after `fetchLeaderMap`:

```typescript
  private async fetchAssignmentCountMap(
    groupIds: number[]
  ): Promise<Map<string, number>> {
    if (groupIds.length === 0) return new Map();

    const CHUNK_SIZE = 15;
    const map = new Map<string, number>();

    for (let i = 0; i < groupIds.length; i += CHUNK_SIZE) {
      const chunk = groupIds.slice(i, i + CHUNK_SIZE);
      const filter = chunk.map((id) => `GroupId eq ${id}`).join(" or ");
      const query = new URLSearchParams({
        $filter: filter,
        $select: "GroupId,LocationId,ScheduleId",
      });

      const response = await fetch(
        `${this.apiUrl}/GroupMemberAssignments?${query}`,
        {
          headers: {
            "Authorization-Token": this.restKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        log(`Warning: Failed to fetch assignment count map: ${response.status}`);
        continue;
      }

      const assignments: { GroupId: number; LocationId: number; ScheduleId: number }[] =
        await response.json();

      for (const a of assignments) {
        const key = `${a.GroupId}|${a.LocationId}|${a.ScheduleId}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }

    return map;
  }
```

- [ ] **Step 6: Update `transformProject` signature and capacity logic**

In `lib/sync/outreach/rock-client.ts`, update the `transformProject` method:

1. Add `assignmentCountMap?: Map<string, number>` as the sixth parameter:

```typescript
  transformProject(
    rawGroup: RockRawSignUpGroup,
    groupIdKeys?: Map<number, string>,
    locationIdKeys?: Map<number, string>,
    scheduleIdKeys?: Map<number, string>,
    leaderMap?: Map<number, { name: string; imageUrl: string | null }[]>,
    assignmentCountMap?: Map<string, number>
  ): OutreachProject | null {
```

2. After the `schedule` and `signupUrl` calculations, add the capacity block (before the `return` statement):

```typescript
    const scheduleConfig = opportunity.GroupLocationScheduleConfigs?.find(
      (c) => c.ScheduleId === schedule?.Id
    ) ?? null;
    const maxCapacity = scheduleConfig?.MaximumCapacity ?? null;
    const locationId = opportunity.Location?.Id ?? null;
    const filledCount =
      locationId != null && schedule != null
        ? (assignmentCountMap?.get(`${rawGroup.Id}|${locationId}|${schedule.Id}`) ?? 0)
        : 0;
    const spotsAvailable =
      maxCapacity != null ? Math.max(0, maxCapacity - filledCount) : null;
    const isFull = maxCapacity != null && filledCount >= maxCapacity;
```

3. Add both new fields to the returned object (after `signup_url`):

```typescript
      signup_url: signupUrl,
      spots_available: spotsAvailable,
      is_full: isFull,
      is_active: rawGroup.IsActive,
```

- [ ] **Step 7: Update `fetchSignUpGroups` — extend expand and wire `assignmentCountMap`**

In `lib/sync/outreach/rock-client.ts`, make two changes to `fetchSignUpGroups`:

1. Add `GroupLocations/GroupLocationScheduleConfigs` to the `$expand` param:

```typescript
      $expand: "Campus,GroupLocations,GroupLocations/Location,GroupLocations/Schedules,GroupLocations/GroupLocationScheduleConfigs",
```

2. Add `fetchAssignmentCountMap` to the `Promise.all` and pass the result to `transformProject`:

```typescript
    const [groupIdKeys, locationIdKeys, scheduleIdKeys, leaderMap, assignmentCountMap] = await Promise.all([
      this.fetchIdKeyMap("Groups", groupIds),
      this.fetchIdKeyMap("Locations", locationIds),
      this.fetchIdKeyMap("Schedules", scheduleIds),
      this.fetchLeaderMap(groupIds),
      this.fetchAssignmentCountMap(groupIds),
    ]);
```

And update the `transformProject` call:

```typescript
      const project = this.transformProject(rawGroup, groupIdKeys, locationIdKeys, scheduleIdKeys, leaderMap, assignmentCountMap);
```

- [ ] **Step 8: Run tests to confirm all pass**

```bash
npx vitest run lib/__tests__/outreach-rock-client.test.ts
```

Expected: all tests pass (previously passing + 11 new).

- [ ] **Step 9: Commit**

```bash
git add lib/sync/outreach/rock-client.ts lib/__tests__/outreach-rock-client.test.ts
git commit -m "feat(outreach-sync): add fetchAssignmentCountMap and spots_available/is_full to transformProject"
```

---

## Task 3: Update Webflow client

**Files:**
- Modify: `lib/sync/outreach/webflow-client.ts`
- Test: `lib/__tests__/outreach-webflow-client.test.ts`

**Interfaces:**
- Consumes: `spots_available: number | null` and `is_full: boolean` on `OutreachProject` from Task 1

- [ ] **Step 1: Update `baseProject` fixture in webflow-client test**

In `lib/__tests__/outreach-webflow-client.test.ts`, add `spots_available` and `is_full` to the `baseProject` object (after `signup_url`):

```typescript
  signup_url: "https://rms.spiritchurch.co/signups/register/abc/location/def/schedule/ghi",
  spots_available: 12,
  is_full: false,
```

- [ ] **Step 2: Write failing tests for the new Webflow fields**

Add these tests inside the existing `describe("transformProjectForWebflow", ...)` block in `lib/__tests__/outreach-webflow-client.test.ts`:

```typescript
  it("writes spots-available when not null", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["spots-available"]).toBe(12);
  });

  it("omits spots-available when null", () => {
    const project = { ...baseProject, spots_available: null };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData["spots-available"]).toBeUndefined();
  });

  it("always writes is-full", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["is-full"]).toBe(false);
  });

  it("writes is-full as true when project is full", () => {
    const project = { ...baseProject, spots_available: 0, is_full: true };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData["is-full"]).toBe(true);
  });
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run lib/__tests__/outreach-webflow-client.test.ts
```

Expected: TypeScript error on `baseProject` (missing new fields) + 4 new test failures.

- [ ] **Step 4: Implement the new fields in `transformProjectForWebflow`**

In `lib/sync/outreach/webflow-client.ts`, add two lines to `transformProjectForWebflow` after the `signup-url` conditional:

```typescript
    if (project.signup_url) fieldData["signup-url"] = project.signup_url;
    if (project.spots_available != null) fieldData["spots-available"] = project.spots_available;
    fieldData["is-full"] = project.is_full;
```

- [ ] **Step 5: Run tests to confirm all pass**

```bash
npx vitest run lib/__tests__/outreach-webflow-client.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add lib/sync/outreach/webflow-client.ts lib/__tests__/outreach-webflow-client.test.ts
git commit -m "feat(outreach-sync): write spots-available and is-full to Webflow"
```

---

## Task 4: Supabase + Webflow setup and end-to-end verification

This task is manual setup + a live sync run to verify everything flows correctly.

**Files:** None (manual dashboard work + live sync trigger)

- [ ] **Step 1: Add columns in Supabase**

In the Supabase dashboard, open the `outreach_projects` table and add two columns:

| Name | Type | Nullable | Default |
|------|------|----------|---------|
| `spots_available` | `int4` | Yes (nullable) | — |
| `is_full` | `bool` | No | `false` |

- [ ] **Step 2: Reload Supabase schema cache**

In the Supabase dashboard: **Project Settings → API → Reload schema cache**. Required before PostgREST will accept the new columns in upsert payloads.

- [ ] **Step 3: Add fields in Webflow**

In the Webflow CMS Designer, open the **outreach-projects** collection and add:

| Field name | Type | Slug |
|------------|------|------|
| Spots Available | Number | `spots-available` |
| Is Full | Switch | `is-full` |

- [ ] **Step 4: Deploy**

```bash
vercel --prod
```

Wait for deployment to finish (typically ~60s).

- [ ] **Step 5: Trigger manual sync**

```bash
curl -s -X POST https://app.spiritchurch.co/api/sync-outreach \
  -H "Authorization: Bearer <CRON_SECRET>" | jq .
```

Expected response:
```json
{
  "success": true,
  "stats": {
    "rockToSupabase": { "processed": 17, "status": "success" },
    "supabaseToWebflow": { "updated": 18, "published": 18, "status": "success" }
  }
}
```

- [ ] **Step 6: Verify Supabase**

In the Supabase table editor, check several rows of `outreach_projects`. Confirm `spots_available` is populated (a non-null integer) and `is_full` is `false` or `true`.

- [ ] **Step 7: Verify Webflow**

In Webflow CMS, open a few outreach project items and confirm the **Spots Available** and **Is Full** fields are populated.

- [ ] **Step 8: Update dev doc**

Add a Session 10 entry to `docs/Development/outreach-sync.md`:
- Document the new `spots_available` and `is_full` fields
- Note the new Supabase columns and Webflow fields
- Update field table in the Webflow Field Schema section
- Note that `GroupMemberAssignments` is now batch-fetched in `fetchSignUpGroups`

- [ ] **Step 9: Commit**

```bash
git add docs/Development/outreach-sync.md
git commit -m "docs: Session 10 — outreach available spots and is_full"
git push
```
