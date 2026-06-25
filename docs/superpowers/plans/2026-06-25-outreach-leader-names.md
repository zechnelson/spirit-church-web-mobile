# Outreach Leader Names & Profile Images — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch up to two GroupMembers with a Leader role from Rock RMS on each outreach sync run and write their names and photo URLs into Supabase and Webflow.

**Architecture:** After the main Sign-Up Groups fetch, one batch call to `/api/GroupMembers` retrieves all leaders for all groups in a single request — the same pattern as the existing `fetchIdKeyMap` batch fetches. The result is a `Map<groupId, { name, imageUrl }[]>` passed into `transformProject`. The four new fields flow through the existing upsert and Webflow transform with no changes to `supabase-client.ts` or the orchestrator (`index.ts`).

**Tech Stack:** TypeScript, Vitest, Rock RMS REST API, Supabase (raw fetch), Webflow API v2.

## Global Constraints

- Vitest for all tests — import from `"vitest"`, not `"jest"`
- Mock `fetch` with `vi.stubGlobal("fetch", vi.fn(...))` and clean up with `vi.unstubAllGlobals()` in `afterEach`
- Private methods accessed in tests via `(client as any).methodName(...)`
- Name format: `(NickName || FirstName) + " " + LastName` — NickName empty string counts as absent
- Image URL: `https://rms.spiritchurch.co/GetImage.ashx?guid=${Photo.Guid}` — null if no Guid
- Webflow field slugs must be confirmed after the CMS fields are created in Task 3 before deploying
- Never send fields not in the Webflow schema (the existing 400-error lesson from groups sync Session 02)

---

### Task 1: Types + Rock Client — add `fetchLeaderMap` and leader fields to `transformProject`

**Files:**
- Modify: `lib/sync/outreach/types.ts`
- Modify: `lib/__tests__/outreach-rock-client.test.ts`
- Modify: `lib/sync/outreach/rock-client.ts`

**Interfaces:**
- Produces: `RockRawGroupMember` (exported from `types.ts`), 4 new fields on `OutreachProject`, `fetchLeaderMap(groupIds: number[]): Promise<Map<number, { name: string; imageUrl: string | null }[]>>`, updated `transformProject` signature with optional 5th param `leaderMap`

---

- [ ] **Step 1: Update `types.ts` — add `RockRawGroupMember` and 4 new fields to `OutreachProject`**

In `lib/sync/outreach/types.ts`, add the new interface after `RockRawSignUpGroup` and extend `OutreachProject`:

```ts
// Add after the RockRawSignUpGroup interface (around line 47):
export interface RockRawGroupMember {
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

In `OutreachProject`, add four fields after `webflow_item_id`:

```ts
  webflow_item_id: string | null;
  leader_name: string | null;
  leader_name_2: string | null;
  leader_image: string | null;
  leader_image_2: string | null;
```

- [ ] **Step 2: Run existing tests to confirm they fail with type errors**

```bash
npm test -- outreach-rock-client
```

Expected: TypeScript compile errors — `OutreachProject` now requires 4 new fields that `transformProject` doesn't return yet. This is the failing baseline.

- [ ] **Step 3: Write failing tests for `fetchLeaderMap` and leader fields in `transformProject`**

In `lib/__tests__/outreach-rock-client.test.ts`, update the imports line and add two new `describe` blocks at the end of the file:

Update the import at the top:
```ts
import { describe, it, expect, afterEach, vi } from "vitest";
```

Add after the closing `});` of the existing `describe("transformProject", ...)` block:

```ts
describe("fetchLeaderMap", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns name and imageUrl for both leaders", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          GroupId: 100,
          GroupRole: { IsLeader: true },
          Person: { FirstName: "James", NickName: "JR", LastName: "Martinez", Photo: { Guid: "photo-guid-1" } },
        },
        {
          GroupId: 100,
          GroupRole: { IsLeader: true },
          Person: { FirstName: "Pam", NickName: null, LastName: "Martinez", Photo: null },
        },
      ]),
    }));

    const map = await (client as any).fetchLeaderMap([100]);
    expect(map.get(100)).toEqual([
      { name: "JR Martinez", imageUrl: "https://rms.spiritchurch.co/GetImage.ashx?guid=photo-guid-1" },
      { name: "Pam Martinez", imageUrl: null },
    ]);
  });

  it("keeps only the first 2 leaders per group", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: { FirstName: "Alice", NickName: null, LastName: "Smith", Photo: null } },
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: { FirstName: "Bob", NickName: null, LastName: "Jones", Photo: null } },
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: { FirstName: "Carol", NickName: null, LastName: "Lee", Photo: null } },
      ]),
    }));

    const map = await (client as any).fetchLeaderMap([100]);
    expect(map.get(100)).toHaveLength(2);
    expect(map.get(100)[0].name).toBe("Alice Smith");
    expect(map.get(100)[1].name).toBe("Bob Jones");
  });

  it("returns empty map on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const map = await (client as any).fetchLeaderMap([100]);
    expect(map.size).toBe(0);
  });

  it("returns empty map without fetching when groupIds is empty", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const map = await (client as any).fetchLeaderMap([]);
    expect(map.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sets imageUrl to null when Photo.Guid is absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: { FirstName: "Alice", NickName: null, LastName: "Smith", Photo: null } },
      ]),
    }));

    const map = await (client as any).fetchLeaderMap([100]);
    expect(map.get(100)![0].imageUrl).toBeNull();
  });

  it("uses NickName over FirstName when NickName is set", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: { FirstName: "James", NickName: "JR", LastName: "Martinez", Photo: null } },
      ]),
    }));

    const map = await (client as any).fetchLeaderMap([100]);
    expect(map.get(100)![0].name).toBe("JR Martinez");
  });

  it("falls back to FirstName when NickName is null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: { FirstName: "James", NickName: null, LastName: "Martinez", Photo: null } },
      ]),
    }));

    const map = await (client as any).fetchLeaderMap([100]);
    expect(map.get(100)![0].name).toBe("James Martinez");
  });

  it("falls back to FirstName when NickName is empty string", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: { FirstName: "James", NickName: "", LastName: "Martinez", Photo: null } },
      ]),
    }));

    const map = await (client as any).fetchLeaderMap([100]);
    expect(map.get(100)![0].name).toBe("James Martinez");
  });

  it("skips members with no Person", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: undefined },
        { GroupId: 100, GroupRole: { IsLeader: true }, Person: { FirstName: "Alice", NickName: null, LastName: "Smith", Photo: null } },
      ]),
    }));

    const map = await (client as any).fetchLeaderMap([100]);
    expect(map.get(100)).toHaveLength(1);
    expect(map.get(100)![0].name).toBe("Alice Smith");
  });
});

describe("transformProject — leader fields", () => {
  it("sets all four leader fields from leader map", () => {
    const leaderMap = new Map([
      [100, [
        { name: "JR Martinez", imageUrl: "https://rms.spiritchurch.co/GetImage.ashx?guid=abc" },
        { name: "Pam Martinez", imageUrl: null },
      ]],
    ]);
    const result = client.transformProject(baseRaw, undefined, undefined, undefined, leaderMap);
    expect(result!.leader_name).toBe("JR Martinez");
    expect(result!.leader_name_2).toBe("Pam Martinez");
    expect(result!.leader_image).toBe("https://rms.spiritchurch.co/GetImage.ashx?guid=abc");
    expect(result!.leader_image_2).toBeNull();
  });

  it("sets all four leader fields to null when leader map is absent", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.leader_name).toBeNull();
    expect(result!.leader_name_2).toBeNull();
    expect(result!.leader_image).toBeNull();
    expect(result!.leader_image_2).toBeNull();
  });

  it("sets all four leader fields to null when group has no entry in leader map", () => {
    const leaderMap = new Map<number, { name: string; imageUrl: string | null }[]>();
    const result = client.transformProject(baseRaw, undefined, undefined, undefined, leaderMap);
    expect(result!.leader_name).toBeNull();
    expect(result!.leader_name_2).toBeNull();
    expect(result!.leader_image).toBeNull();
    expect(result!.leader_image_2).toBeNull();
  });
});
```

- [ ] **Step 4: Run new tests to confirm they fail**

```bash
npm test -- outreach-rock-client
```

Expected: FAIL — `fetchLeaderMap` does not exist yet; `transformProject` missing leader fields.

- [ ] **Step 5: Implement `fetchLeaderMap` in `rock-client.ts`**

Add the import for `RockRawGroupMember` at the top of `lib/sync/outreach/rock-client.ts`:

```ts
import type { RockRawSignUpGroup, OutreachProject, RockRawGroupMember } from "./types";
```

Add this private method after `fetchIdKeyMap` (around line 46, before `fetchSignUpGroups`):

```ts
  private async fetchLeaderMap(
    groupIds: number[]
  ): Promise<Map<number, { name: string; imageUrl: string | null }[]>> {
    if (groupIds.length === 0) return new Map();

    const groupFilter = groupIds.map((id) => `GroupId eq ${id}`).join(" or ");
    const filter = `(${groupFilter}) and GroupRole/IsLeader eq true`;
    const query = new URLSearchParams({ $filter: filter, $expand: "Person,GroupRole" });

    const response = await fetch(`${this.apiUrl}/GroupMembers?${query}`, {
      headers: {
        "Authorization-Token": this.restKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      log(`Warning: Failed to fetch leader map: ${response.status}`);
      return new Map();
    }

    const members: RockRawGroupMember[] = await response.json();
    const map = new Map<number, { name: string; imageUrl: string | null }[]>();

    for (const member of members) {
      if (!member.Person) continue;
      const existing = map.get(member.GroupId) ?? [];
      if (existing.length >= 2) continue;

      const { FirstName, NickName, LastName, Photo } = member.Person;
      const firstName = NickName?.trim() || FirstName;
      const name = `${firstName} ${LastName}`;
      const imageUrl = Photo?.Guid
        ? `${RMS_BASE_URL}/GetImage.ashx?guid=${Photo.Guid}`
        : null;

      existing.push({ name, imageUrl });
      map.set(member.GroupId, existing);
    }

    return map;
  }
```

- [ ] **Step 6: Update `fetchSignUpGroups` to call `fetchLeaderMap` in parallel**

In `fetchSignUpGroups`, replace the existing `Promise.all` destructuring (around line 81):

```ts
    // Before:
    const [groupIdKeys, locationIdKeys, scheduleIdKeys] = await Promise.all([
      this.fetchIdKeyMap("Groups", groupIds),
      this.fetchIdKeyMap("GroupLocations", locationIds),
      this.fetchIdKeyMap("Schedules", scheduleIds),
    ]);

    // After:
    const [groupIdKeys, locationIdKeys, scheduleIdKeys, leaderMap] = await Promise.all([
      this.fetchIdKeyMap("Groups", groupIds),
      this.fetchIdKeyMap("GroupLocations", locationIds),
      this.fetchIdKeyMap("Schedules", scheduleIds),
      this.fetchLeaderMap(groupIds),
    ]);
```

Update the `transformProject` call in the loop (around line 89):

```ts
    // Before:
      const project = this.transformProject(rawGroup, groupIdKeys, locationIdKeys, scheduleIdKeys);

    // After:
      const project = this.transformProject(rawGroup, groupIdKeys, locationIdKeys, scheduleIdKeys, leaderMap);
```

- [ ] **Step 7: Update `transformProject` signature and return object**

Update the method signature (around line 100):

```ts
  transformProject(
    rawGroup: RockRawSignUpGroup,
    groupIdKeys?: Map<number, string>,
    locationIdKeys?: Map<number, string>,
    scheduleIdKeys?: Map<number, string>,
    leaderMap?: Map<number, { name: string; imageUrl: string | null }[]>
  ): OutreachProject | null {
```

In the `return { ... }` object at the end of `transformProject`, add four fields after `webflow_item_id`:

```ts
      webflow_item_id: null,
      leader_name: leaderMap?.get(rawGroup.Id)?.[0]?.name ?? null,
      leader_name_2: leaderMap?.get(rawGroup.Id)?.[1]?.name ?? null,
      leader_image: leaderMap?.get(rawGroup.Id)?.[0]?.imageUrl ?? null,
      leader_image_2: leaderMap?.get(rawGroup.Id)?.[1]?.imageUrl ?? null,
```

- [ ] **Step 8: Run all outreach-rock-client tests**

```bash
npm test -- outreach-rock-client
```

Expected: All tests pass. Count should be 19 existing + 12 new = 31 tests.

- [ ] **Step 9: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All 127 existing tests still pass, plus the 12 new ones (139 total).

- [ ] **Step 10: Commit**

```bash
git add lib/sync/outreach/types.ts lib/sync/outreach/rock-client.ts lib/__tests__/outreach-rock-client.test.ts
git commit -m "feat(outreach-sync): fetch leader names and images from Rock GroupMembers"
```

---

### Task 2: Webflow Client — write leader fields in `transformProjectForWebflow`

**Files:**
- Modify: `lib/__tests__/outreach-webflow-client.test.ts`
- Modify: `lib/sync/outreach/webflow-client.ts`

**Interfaces:**
- Consumes: `OutreachProject.leader_name`, `leader_name_2`, `leader_image`, `leader_image_2` from Task 1
- Produces: `fieldData["leader-name"]`, `fieldData["leader-name-2"]`, `fieldData["leader-profile-image"]`, `fieldData["leader-profile-image-2"]` in `transformProjectForWebflow`

> **Note:** The field slugs `leader-name`, `leader-name-2`, `leader-profile-image`, `leader-profile-image-2` are placeholders. Task 3 creates the Webflow fields and confirms the actual slugs. If they differ, update the string keys in `transformProjectForWebflow` and these tests before deploying.

---

- [ ] **Step 1: Update `baseProject` fixture in `outreach-webflow-client.test.ts`**

The `baseProject` object now needs the 4 new fields. In `lib/__tests__/outreach-webflow-client.test.ts`, add them to the `baseProject` constant after `webflow_item_id: null`:

```ts
const baseProject: OutreachProject = {
  rock_group_id: 100,
  rock_opportunity_id: 200,
  rock_schedule_id: 300,
  name: "Feed My Starving Children",
  slug: "200",
  description: "Help pack meals",
  schedule_display: "Once at 7/11/2026 9:00 AM",
  schedule_datetime: "2026-07-11T09:00:00",
  location_address: "1100 W Grove Pkwy Ste 101, Tempe, AZ 85283",
  city: "Tempe",
  campus: "Chandler Campus",
  semester: "Fall 2026",
  event: "Serve Day",
  category: "Food Prep & Distribution",
  kids_welcome: true,
  handicap_accessible: true,
  tools_needed: "Gloves and apron",
  project_type: "In-Person",
  signup_url: "https://rms.spiritchurch.co/signups/register/abc/location/def/schedule/ghi",
  is_active: true,
  is_archived: false,
  webflow_item_id: null,
  leader_name: null,
  leader_name_2: null,
  leader_image: null,
  leader_image_2: null,
};
```

- [ ] **Step 2: Write failing tests for leader fields in `transformProjectForWebflow`**

Add a new `describe` block at the end of `lib/__tests__/outreach-webflow-client.test.ts` (before the final line):

```ts
describe("transformProjectForWebflow — leader fields", () => {
  it("maps all four leader fields when present", () => {
    const project: OutreachProject = {
      ...baseProject,
      leader_name: "JR Martinez",
      leader_name_2: "Pam Martinez",
      leader_image: "https://rms.spiritchurch.co/GetImage.ashx?guid=abc",
      leader_image_2: "https://rms.spiritchurch.co/GetImage.ashx?guid=def",
    };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData["leader-name"]).toBe("JR Martinez");
    expect(fieldData["leader-name-2"]).toBe("Pam Martinez");
    expect(fieldData["leader-profile-image"]).toBe("https://rms.spiritchurch.co/GetImage.ashx?guid=abc");
    expect(fieldData["leader-profile-image-2"]).toBe("https://rms.spiritchurch.co/GetImage.ashx?guid=def");
  });

  it("omits all four leader fields when null", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("leader-name");
    expect(fieldData).not.toHaveProperty("leader-name-2");
    expect(fieldData).not.toHaveProperty("leader-profile-image");
    expect(fieldData).not.toHaveProperty("leader-profile-image-2");
  });

  it("includes leader name but omits leader image when image is null", () => {
    const project: OutreachProject = {
      ...baseProject,
      leader_name: "JR Martinez",
      leader_image: null,
    };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData["leader-name"]).toBe("JR Martinez");
    expect(fieldData).not.toHaveProperty("leader-profile-image");
  });
});
```

- [ ] **Step 3: Run new tests to confirm they fail**

```bash
npm test -- outreach-webflow-client
```

Expected: FAIL — `leader-name` etc. not in `fieldData` yet.

- [ ] **Step 4: Update `transformProjectForWebflow` in `webflow-client.ts`**

In `lib/sync/outreach/webflow-client.ts`, add four lines inside `transformProjectForWebflow` after the `if (project.signup_url)` line (around line 168) and before the `try` block for campus:

```ts
    if (project.signup_url) fieldData["signup-url"] = project.signup_url;

    // Leader fields — slugs confirmed after Webflow CMS fields are created in Task 3
    if (project.leader_name) fieldData["leader-name"] = project.leader_name;
    if (project.leader_name_2) fieldData["leader-name-2"] = project.leader_name_2;
    if (project.leader_image) fieldData["leader-profile-image"] = project.leader_image;
    if (project.leader_image_2) fieldData["leader-profile-image-2"] = project.leader_image_2;

    try {
      if (project.campus && this.campusMap) {
```

- [ ] **Step 5: Run all outreach-webflow-client tests**

```bash
npm test -- outreach-webflow-client
```

Expected: All tests pass. Count should be 20 existing + 3 new = 23 tests.

- [ ] **Step 6: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All tests pass (139 from Task 1 + 3 new = 142 total).

- [ ] **Step 7: Commit**

```bash
git add lib/__tests__/outreach-webflow-client.test.ts lib/sync/outreach/webflow-client.ts
git commit -m "feat(outreach-sync): write leader names and images to Webflow CMS"
```

---

### Task 3: Infrastructure + Deploy

**Files:**
- Manual: Supabase dashboard — add 4 columns to `outreach_projects`
- Manual: Webflow CMS — add 4 PlainText fields to `outreach-projects` collection
- Possibly modify: `lib/sync/outreach/webflow-client.ts` — update slug keys if Webflow assigned different suffixes
- Possibly modify: `lib/__tests__/outreach-webflow-client.test.ts` — update slug keys in tests to match

---

- [ ] **Step 1: Add 4 columns to Supabase `outreach_projects` table**

In Supabase dashboard (https://supabase.com → project → Table Editor → `outreach_projects`):

Add these columns (type: `text`, nullable: yes, no default):
- `leader_name`
- `leader_name_2`
- `leader_image`
- `leader_image_2`

No code changes needed — `supabase-client.ts` upserts by spreading the full `OutreachProject` object.

- [ ] **Step 2: Add 4 PlainText fields to Webflow `outreach-projects` collection**

In Webflow Designer or via Webflow MCP, add 4 new fields to the `outreach-projects` collection (ID: `6a28cbac65cb0f0593f53802`):

| Display Name | Type | Required |
|---|---|---|
| Leader Name | Plain Text | No |
| 2nd Leader Name | Plain Text | No |
| Leader Profile Image | Plain Text | No |
| 2nd Leader Profile Image | Plain Text | No |

After creating each field, **note the actual slug Webflow assigned** — it may add numeric suffixes (e.g., `leader-name-2` could become `leader-name-3` if there was a prior same-named field).

- [ ] **Step 3: Confirm Webflow field slugs**

After creating the fields, check the actual slugs via Webflow Designer (field settings) or the Webflow API:

```bash
curl -s "https://api.webflow.com/v2/collections/6a28cbac65cb0f0593f53802/fields" \
  -H "Authorization: Bearer $WEBFLOW_API_TOKEN" \
  -H "accept: application/json" | jq '[.fields[] | {displayName: .displayName, slug: .slug}]'
```

Look for the 4 new fields. Expected slugs: `leader-name`, `leader-name-2`, `leader-profile-image`, `leader-profile-image-2`.

- [ ] **Step 4: Update slug keys in code if different from expected**

If the actual slugs differ from the expected ones, update them in two places:

In `lib/sync/outreach/webflow-client.ts`, update the `fieldData` keys (the 4 lines added in Task 2 Step 4).

In `lib/__tests__/outreach-webflow-client.test.ts`, update the property names in the Task 2 tests.

Then re-run tests:

```bash
npm test
```

Expected: All tests pass.

If you changed any files, commit:

```bash
git add lib/sync/outreach/webflow-client.ts lib/__tests__/outreach-webflow-client.test.ts
git commit -m "fix(outreach-sync): correct Webflow leader field slugs to match actual CMS schema"
```

- [ ] **Step 5: Deploy to Vercel production**

```bash
vercel build --prod && vercel deploy --prebuilt --prod
```

Wait for deployment to complete and confirm the URL shown is the production deployment.

- [ ] **Step 6: Trigger manual sync**

```bash
curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-outreach \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response shape:
```json
{
  "success": true,
  "stats": {
    "rockToSupabase": { "processed": 3, "status": "success" },
    "supabaseToWebflow": { "created": 0, "updated": 3, "published": 3, "status": "success" }
  }
}
```

- [ ] **Step 7: Verify leader data in Supabase**

In Supabase dashboard → Table Editor → `outreach_projects`, confirm `leader_name`, `leader_name_2`, `leader_image`, `leader_image_2` are populated for at least one row. If all four are null on every row, the Rock GroupMembers fetch may have failed — check Vercel function logs.

- [ ] **Step 8: Verify leader data in Webflow**

In Webflow CMS → `outreach-projects` collection, open one item and confirm the Leader Name and Leader Profile Image fields are populated.

- [ ] **Step 9: Update docs**

Run `/update-docs` to log this session in `docs/Development/outreach-sync.md`.
