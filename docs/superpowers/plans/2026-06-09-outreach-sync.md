# Outreach Projects Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Rock RMS → Supabase → Webflow CMS sync pipeline for Outreach Projects (Sign-Up Groups), mirroring the existing Groups Sync architecture, so users can browse and sign up for outreach opportunities on a Webflow page.

**Architecture:** Flat Supabase table (`outreach_projects`) with one row per Opportunity (GroupLocation + Schedule in Rock). A new `lib/sync/outreach/` module with its own rock/supabase/webflow clients and orchestrator. A new `app/api/sync-outreach/route.ts` cron endpoint fires every 6 hours alongside the existing Groups cron.

**Tech Stack:** Next.js App Router (TypeScript), Vitest, Supabase (raw fetch, no supabase-js), Webflow CMS v2 API, Rock RMS REST API.

**Spec:** `docs/superpowers/specs/2026-06-09-outreach-sync-design.md`

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/sync/outreach/types.ts` | All TypeScript interfaces for this pipeline |
| Create | `lib/sync/outreach/rock-client.ts` | Fetch Sign-Up Groups + Opportunities from Rock, transform to OutreachProject |
| Create | `lib/sync/outreach/supabase-client.ts` | Upsert/query/delete `outreach_projects` table |
| Create | `lib/sync/outreach/webflow-client.ts` | Create/update/delete/publish Webflow CMS items |
| Create | `lib/sync/outreach/index.ts` | `fullOutreachSync()` orchestrator |
| Create | `app/api/sync-outreach/route.ts` | GET (cron) + POST (manual) handler |
| Create | `lib/__tests__/outreach-rock-client.test.ts` | Unit tests for rock-client |
| Create | `lib/__tests__/outreach-webflow-client.test.ts` | Unit tests for webflow-client |
| Create | `lib/__tests__/outreach-sync-route.test.ts` | Unit tests for route handler |
| Modify | `vercel.json` | Add cron entry for `/api/sync-outreach` |

---

## Task 0: Prerequisites — Supabase table + Vercel env vars

**No code.** Complete these before writing any TypeScript.

### Step 0.1: Create the Supabase table

Open the Supabase dashboard → SQL Editor and run:

```sql
create table outreach_projects (
  id serial primary key,
  rock_group_id integer not null,
  rock_opportunity_id integer not null unique,
  rock_schedule_id integer,
  name text not null,
  slug text not null unique,
  description text,
  schedule_display text,
  schedule_datetime timestamptz,
  location_address text,
  city text,
  campus text,
  semester text,
  event text,
  category text,
  kids_welcome boolean default true,
  handicap_accessible boolean default true,
  tools_needed text,
  project_type text,
  signup_url text,
  is_active boolean default true,
  is_archived boolean default false,
  webflow_item_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Step 0.2: Add env vars to Vercel

In the Vercel dashboard → Project Settings → Environment Variables, add these for Production + Preview + Development:

| Variable | Value |
|---|---|
| `ROCK_SIGNUP_GROUP_TYPE_ID` | The integer GroupType ID for Sign-Up Groups in Rock (check Rock Admin → Group Types) |
| `WEBFLOW_OUTREACH_COLLECTION_ID` | Create the `outreach-projects` collection in Webflow first, then paste its ID |
| `WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID` | Create `outreach-campus` reference collection in Webflow, paste ID |
| `WEBFLOW_OUTREACH_EVENT_COLLECTION_ID` | Create `outreach-events` reference collection in Webflow, paste ID |
| `WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID` | Create `outreach-categories` reference collection in Webflow, paste ID |
| `WEBFLOW_OUTREACH_CITY_COLLECTION_ID` | Create `outreach-cities` reference collection in Webflow, paste ID |

### Step 0.3: Create Webflow collections

In Webflow CMS, create these collections **before first sync** (reference items must exist for ref lookups to work):

1. `outreach-campus` — add one item per campus (e.g., "Chandler Campus")
2. `outreach-events` — add one item per event (e.g., "Serve Day")
3. `outreach-categories` — add one item per category (e.g., "Food Prep & Distribution", "Communications")
4. `outreach-cities` — add one item per city (e.g., "Tempe", "Phoenix")
5. `outreach-projects` — create with all fields from the Webflow field table in the spec

### Step 0.4: Pull updated env to local

```bash
vercel env pull --environment production .env.local
```

Add `ROCK_SIGNUP_GROUP_TYPE_ID` manually if it wasn't pulled (Vercel omits sensitive vars from pull).

### Step 0.5: Verify Rock API attribute key names

Before implementing rock-client, make one diagnostic call to confirm the attribute key names Rock uses for Sign-Up Group custom fields. Run this in a scratch script or directly in the terminal:

```bash
curl -s "https://rms.spiritchurch.co/api/Groups?$filter=GroupTypeId%20eq%20<SIGNUP_GROUP_TYPE_ID>&$top=1&loadAttributes=simple" \
  -H "Authorization-Token: <ROCK_REST_KEY>" | jq '.[] | .AttributeValues | keys'
```

Expected output: a JSON array of attribute key strings. Look for keys corresponding to Semester, Event, Category, KidsWelcome, HandicapAccessible, ToolsSuppliesNeeded, ProjectType. Update the key names in `types.ts` and `rock-client.ts` if they differ from what the plan uses.

Also check if `IdKey` is present on the response:

```bash
curl -s "https://rms.spiritchurch.co/api/Groups?$filter=GroupTypeId%20eq%20<SIGNUP_GROUP_TYPE_ID>&$top=1&loadAttributes=simple&$expand=Campus,GroupLocations(\$expand=Location,Schedules)" \
  -H "Authorization-Token: <ROCK_REST_KEY>" | jq '.[0] | {Id, IdKey, GroupLocations: .GroupLocations[0] | {Id, IdKey, Schedules: .Schedules[0] | {Id, IdKey, Description, NextStartDateTime}}}'
```

Confirm that `IdKey` is present on the Group, GroupLocation, and Schedule objects. If it is not, the `buildSignupUrl` helper will need to call `/api/Utilities/GetIdKey/{id}` per entity (add a `fetchIdKey(id: number)` method and call it during fetch, not transform).

---

## Task 1: types.ts

**Files:**
- Create: `lib/sync/outreach/types.ts`

- [ ] **Step 1.1: Create the types file**

```typescript
// lib/sync/outreach/types.ts
export interface AttributeValue {
  Value?: string;
  ValueFormatted?: string;
}

export interface RockSchedule {
  Id: number;
  IdKey?: string;
  Description?: string;
  NextStartDateTime?: string;
  EffectiveStartDate?: string;
}

export interface RockOpportunityLocation {
  Id: number;
  IdKey?: string;
  Location?: {
    Street1?: string;
    City?: string;
    State?: string;
    PostalCode?: string;
    FormattedAddress?: string;
  };
  Schedules?: RockSchedule[];
}

export interface RockRawSignUpGroup {
  Id: number;
  IdKey?: string;
  Name: string;
  Description?: string;
  IsActive: boolean;
  IsArchived?: boolean;
  GroupTypeId: number;
  Campus?: { Name: string };
  AttributeValues?: {
    // NOTE: verify these key names against live Rock API before implementing rock-client
    // Run the diagnostic curl in Task 0 Step 5 first
    Semester?: AttributeValue;
    Event?: AttributeValue;
    Category?: AttributeValue;
    KidsWelcome?: AttributeValue;
    HandicapAccessible?: AttributeValue;
    ToolsSuppliesNeeded?: AttributeValue;
    ProjectType?: AttributeValue;
    [key: string]: AttributeValue | undefined;
  };
  GroupLocations?: RockOpportunityLocation[];
}

export interface OutreachProject {
  rock_group_id: number;
  rock_opportunity_id: number;
  rock_schedule_id: number | null;
  name: string;
  slug: string;
  description: string;
  schedule_display: string | null;
  schedule_datetime: string | null;
  location_address: string | null;
  city: string | null;
  campus: string | null;
  semester: string | null;
  event: string | null;
  category: string | null;
  kids_welcome: boolean;
  handicap_accessible: boolean;
  tools_needed: string | null;
  project_type: string | null;
  signup_url: string | null;
  is_active: boolean;
  is_archived: boolean;
  webflow_item_id: string | null;
}

export interface WebflowOutreachItem {
  id: string;
  fieldData: Record<string, unknown>;
}

export interface OutreachSyncEnv {
  ROCK_API_URL: string;
  ROCK_REST_KEY: string;
  ROCK_SIGNUP_GROUP_TYPE_ID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  WEBFLOW_API_TOKEN: string;
  WEBFLOW_SITE_ID: string;
  WEBFLOW_OUTREACH_COLLECTION_ID: string;
  WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID: string;
  WEBFLOW_OUTREACH_EVENT_COLLECTION_ID: string;
  WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID: string;
  WEBFLOW_OUTREACH_CITY_COLLECTION_ID: string;
  CRON_SECRET: string;
}

export interface OutreachSyncStats {
  startedAt: string;
  rockToSupabase: { processed: number; status: string };
  supabaseToWebflow: {
    processed: number;
    created: number;
    updated: number;
    deleted: number;
    published: number;
    status: string;
  };
  duration: number;
}
```

- [ ] **Step 1.2: Commit**

```bash
git add lib/sync/outreach/types.ts
git commit -m "feat(outreach-sync): add TypeScript types"
```

---

## Task 2: Rock Client (TDD)

**Files:**
- Create: `lib/__tests__/outreach-rock-client.test.ts`
- Create: `lib/sync/outreach/rock-client.ts`

- [ ] **Step 2.1: Write the failing tests**

```typescript
// lib/__tests__/outreach-rock-client.test.ts
import { describe, it, expect } from "vitest";
import { OutreachRockClient } from "../sync/outreach/rock-client";
import type { RockRawSignUpGroup } from "../sync/outreach/types";

const client = new OutreachRockClient(
  "https://rms.spiritchurch.co/api",
  "test-key",
  42
);

const baseRaw: RockRawSignUpGroup = {
  Id: 100,
  IdKey: "abc123",
  Name: "Feed My Starving Children",
  Description: "Help pack meals",
  GroupTypeId: 42,
  IsActive: true,
  IsArchived: false,
  Campus: { Name: "Chandler Campus" },
  AttributeValues: {
    Semester: { ValueFormatted: "Fall 2026" },
    Event: { ValueFormatted: "Serve Day" },
    Category: { ValueFormatted: "Food Prep & Distribution" },
    KidsWelcome: { Value: "True" },
    HandicapAccessible: { Value: "True" },
    ToolsSuppliesNeeded: { Value: "Gloves and apron" },
    ProjectType: { ValueFormatted: "In-Person" },
  },
  GroupLocations: [
    {
      Id: 200,
      IdKey: "loc456",
      Location: {
        Street1: "1100 W Grove Pkwy Ste 101",
        City: "Tempe",
        State: "AZ",
        PostalCode: "85283",
        FormattedAddress: "1100 W Grove Pkwy Ste 101, Tempe, AZ 85283",
      },
      Schedules: [
        {
          Id: 300,
          IdKey: "sch789",
          Description: "Once at 7/11/2026 9:00 AM",
          NextStartDateTime: "2026-07-11T09:00:00",
        },
      ],
    },
  ],
};

describe("transformProject", () => {
  it("maps basic fields", () => {
    const result = client.transformProject(baseRaw);
    expect(result).not.toBeNull();
    expect(result!.rock_group_id).toBe(100);
    expect(result!.rock_opportunity_id).toBe(200);
    expect(result!.rock_schedule_id).toBe(300);
    expect(result!.name).toBe("Feed My Starving Children");
    expect(result!.slug).toBe("feed-my-starving-children");
    expect(result!.description).toBe("Help pack meals");
    expect(result!.is_active).toBe(true);
    expect(result!.is_archived).toBe(false);
  });

  it("constructs signup_url from IdKeys", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.signup_url).toBe(
      "https://rms.spiritchurch.co/signups/register/abc123/location/loc456/schedule/sch789"
    );
  });

  it("returns null signup_url when group IdKey is missing", () => {
    const raw = { ...baseRaw, IdKey: undefined };
    const result = client.transformProject(raw);
    expect(result!.signup_url).toBeNull();
  });

  it("returns null signup_url when location IdKey is missing", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [{ ...baseRaw.GroupLocations![0], IdKey: undefined }],
    };
    const result = client.transformProject(raw);
    expect(result!.signup_url).toBeNull();
  });

  it("returns null signup_url when schedule IdKey is missing", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [
        {
          ...baseRaw.GroupLocations![0],
          Schedules: [{ ...baseRaw.GroupLocations![0].Schedules![0], IdKey: undefined }],
        },
      ],
    };
    const result = client.transformProject(raw);
    expect(result!.signup_url).toBeNull();
  });

  it("extracts city from Location.City", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.city).toBe("Tempe");
  });

  it("uses FormattedAddress for location_address", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.location_address).toBe(
      "1100 W Grove Pkwy Ste 101, Tempe, AZ 85283"
    );
  });

  it("falls back to assembled address when FormattedAddress is absent", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      GroupLocations: [
        {
          ...baseRaw.GroupLocations![0],
          Location: {
            Street1: "123 Main St",
            City: "Phoenix",
            State: "AZ",
            PostalCode: "85001",
          },
        },
      ],
    };
    const result = client.transformProject(raw);
    expect(result!.location_address).toBe("123 Main St, Phoenix, AZ, 85001");
  });

  it("maps schedule_display from Schedule.Description", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.schedule_display).toBe("Once at 7/11/2026 9:00 AM");
  });

  it("maps schedule_datetime from NextStartDateTime", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.schedule_datetime).toBe("2026-07-11T09:00:00");
  });

  it("maps campus, semester, event, category, project_type", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.campus).toBe("Chandler Campus");
    expect(result!.semester).toBe("Fall 2026");
    expect(result!.event).toBe("Serve Day");
    expect(result!.category).toBe("Food Prep & Distribution");
    expect(result!.project_type).toBe("In-Person");
  });

  it("maps kids_welcome=true when attribute Value is 'True'", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.kids_welcome).toBe(true);
  });

  it("maps kids_welcome=false when attribute Value is 'False'", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      AttributeValues: {
        ...baseRaw.AttributeValues,
        KidsWelcome: { Value: "False" },
      },
    };
    const result = client.transformProject(raw);
    expect(result!.kids_welcome).toBe(false);
  });

  it("defaults kids_welcome to true when attribute is absent", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      AttributeValues: { ...baseRaw.AttributeValues, KidsWelcome: undefined },
    };
    const result = client.transformProject(raw);
    expect(result!.kids_welcome).toBe(true);
  });

  it("defaults handicap_accessible to true when attribute is absent", () => {
    const raw: RockRawSignUpGroup = {
      ...baseRaw,
      AttributeValues: { ...baseRaw.AttributeValues, HandicapAccessible: undefined },
    };
    const result = client.transformProject(raw);
    expect(result!.handicap_accessible).toBe(true);
  });

  it("maps is_archived=true", () => {
    const raw = { ...baseRaw, IsArchived: true };
    const result = client.transformProject(raw);
    expect(result!.is_archived).toBe(true);
  });

  it("defaults is_archived to false when absent", () => {
    const { IsArchived: _, ...rawWithout } = baseRaw;
    const result = client.transformProject(rawWithout as RockRawSignUpGroup);
    expect(result!.is_archived).toBe(false);
  });

  it("returns null when group has no GroupLocations", () => {
    const raw = { ...baseRaw, GroupLocations: [] };
    const result = client.transformProject(raw);
    expect(result).toBeNull();
  });

  it("sets webflow_item_id to null", () => {
    const result = client.transformProject(baseRaw);
    expect(result!.webflow_item_id).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/outreach-rock-client.test.ts
```

Expected: FAIL with `Cannot find module '../sync/outreach/rock-client'`

- [ ] **Step 2.3: Implement rock-client**

```typescript
// lib/sync/outreach/rock-client.ts
import type { RockRawSignUpGroup, OutreachProject } from "./types";
import { slugify, log } from "../utils";

const RMS_BASE_URL = "https://rms.spiritchurch.co";

export class OutreachRockClient {
  private apiUrl: string;
  private restKey: string;
  private groupTypeId: number;

  constructor(apiUrl: string, restKey: string, groupTypeId: number) {
    this.apiUrl =
      apiUrl.replace("/api/v2", "").replace(/\/api$/, "") + "/api";
    this.restKey = restKey;
    this.groupTypeId = groupTypeId;
  }

  async fetchSignUpGroups(): Promise<OutreachProject[]> {
    log(`Fetching Sign-Up Groups from Rock (GroupTypeId=${this.groupTypeId})...`);

    const query = new URLSearchParams({
      $filter: `GroupTypeId eq ${this.groupTypeId}`,
      $expand: "Campus,GroupLocations($expand=Location,Schedules)",
      loadAttributes: "simple",
    });

    const response = await fetch(`${this.apiUrl}/Groups?${query}`, {
      headers: {
        "Authorization-Token": this.restKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Rock RMS API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const rawGroups: RockRawSignUpGroup[] = await response.json();
    log(`Fetched ${rawGroups.length} Sign-Up Groups`);

    const projects: OutreachProject[] = [];
    for (const rawGroup of rawGroups) {
      const project = this.transformProject(rawGroup);
      if (project) {
        projects.push(project);
      } else {
        log(`Skipping Sign-Up Group ${rawGroup.Id} (${rawGroup.Name}): no opportunities`);
      }
    }

    return projects;
  }

  transformProject(rawGroup: RockRawSignUpGroup): OutreachProject | null {
    const opportunity = rawGroup.GroupLocations?.[0];

    if (!opportunity) {
      return null;
    }

    const schedule = opportunity.Schedules?.[0] ?? null;

    const groupIdKey = rawGroup.IdKey;
    const locationIdKey = opportunity.IdKey;
    const scheduleIdKey = schedule?.IdKey;

    const signupUrl =
      groupIdKey && locationIdKey && scheduleIdKey
        ? `${RMS_BASE_URL}/signups/register/${groupIdKey}/location/${locationIdKey}/schedule/${scheduleIdKey}`
        : null;

    const location = opportunity.Location;
    const locationAddress =
      location?.FormattedAddress ??
      [location?.Street1, location?.City, location?.State, location?.PostalCode]
        .filter(Boolean)
        .join(", ") ||
      null;

    const attrs = rawGroup.AttributeValues ?? {};

    return {
      rock_group_id: rawGroup.Id,
      rock_opportunity_id: opportunity.Id,
      rock_schedule_id: schedule?.Id ?? null,
      name: rawGroup.Name,
      slug: slugify(rawGroup.Name),
      description: rawGroup.Description ?? "",
      schedule_display: schedule?.Description ?? null,
      schedule_datetime: schedule?.NextStartDateTime ?? null,
      location_address: locationAddress,
      city: location?.City ?? null,
      campus: rawGroup.Campus?.Name ?? null,
      semester: attrs.Semester?.ValueFormatted ?? null,
      event: attrs.Event?.ValueFormatted ?? null,
      category: attrs.Category?.ValueFormatted ?? null,
      kids_welcome: (attrs.KidsWelcome?.Value ?? "True") === "True",
      handicap_accessible: (attrs.HandicapAccessible?.Value ?? "True") === "True",
      tools_needed: attrs.ToolsSuppliesNeeded?.Value ?? null,
      project_type: attrs.ProjectType?.ValueFormatted ?? null,
      signup_url: signupUrl,
      is_active: rawGroup.IsActive,
      is_archived: rawGroup.IsArchived ?? false,
      webflow_item_id: null,
    };
  }
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
npx vitest run lib/__tests__/outreach-rock-client.test.ts
```

Expected: All tests PASS

- [ ] **Step 2.5: Commit**

```bash
git add lib/__tests__/outreach-rock-client.test.ts lib/sync/outreach/rock-client.ts
git commit -m "feat(outreach-sync): rock client with TDD"
```

---

## Task 3: Supabase Client (TDD)

**Files:**
- Create: `lib/sync/outreach/supabase-client.ts`

No separate test file — the supabase client uses raw fetch and is tested adequately by integration. However, write three focused unit tests inline with the implementation to cover the public surface.

- [ ] **Step 3.1: Implement supabase-client**

```typescript
// lib/sync/outreach/supabase-client.ts
import type { OutreachProject } from "./types";
import { log, logError } from "../utils";

export class OutreachSupabaseClient {
  private url: string;
  private serviceKey: string;

  constructor(url: string, serviceKey: string) {
    this.url = url;
    this.serviceKey = serviceKey;
  }

  private get headers() {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      "Content-Type": "application/json",
    };
  }

  async upsertProjects(projects: OutreachProject[]): Promise<OutreachProject[]> {
    log(`Upserting ${projects.length} outreach projects to Supabase...`);

    const payload = projects.map((p) => ({
      ...p,
      updated_at: new Date().toISOString(),
    }));

    const response = await fetch(
      `${this.url}/rest/v1/outreach_projects?on_conflict=rock_opportunity_id`,
      {
        method: "POST",
        headers: {
          ...this.headers,
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase upsert failed: ${response.status} - ${errorText}`
      );
    }

    const result: OutreachProject[] = await response.json();
    log(`Upserted ${result.length} outreach projects`);
    return result;
  }

  async getAllProjects(): Promise<OutreachProject[]> {
    log("Fetching all outreach projects from Supabase...");

    const response = await fetch(
      `${this.url}/rest/v1/outreach_projects?order=name.asc`,
      { headers: this.headers }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase fetch failed: ${response.status} - ${errorText}`
      );
    }

    const projects: OutreachProject[] = await response.json();
    log(`Retrieved ${projects.length} outreach projects`);
    return projects;
  }

  async deleteProjects(rockGroupIds: number[]): Promise<number> {
    if (rockGroupIds.length === 0) return 0;

    log(`Deleting ${rockGroupIds.length} outreach projects from Supabase...`);

    const idList = rockGroupIds.join(",");
    const response = await fetch(
      `${this.url}/rest/v1/outreach_projects?rock_group_id=in.(${idList})`,
      {
        method: "DELETE",
        headers: {
          ...this.headers,
          Prefer: "return=representation",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Supabase delete failed: ${response.status} - ${errorText}`
      );
    }

    const result: OutreachProject[] = await response.json();
    log(`Deleted ${result.length} outreach projects from Supabase`);
    return result.length;
  }

  async logSync(
    syncType: string,
    status: "success" | "failed",
    stats: {
      processed?: number;
      created?: number;
      updated?: number;
      startedAt: string;
      duration: number;
    },
    error?: Error
  ): Promise<void> {
    try {
      await fetch(`${this.url}/rest/v1/sync_logs`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          sync_type: syncType,
          status,
          groups_processed: stats.processed ?? 0,
          groups_created: stats.created ?? 0,
          groups_updated: stats.updated ?? 0,
          error_message: error?.message ?? null,
          started_at: stats.startedAt,
          completed_at: new Date().toISOString(),
          duration_seconds: stats.duration,
        }),
      });
      log(`Logged ${syncType} sync: ${status}`);
    } catch (err) {
      logError("Failed to log sync", err as Error);
    }
  }
}
```

- [ ] **Step 3.2: Commit**

```bash
git add lib/sync/outreach/supabase-client.ts
git commit -m "feat(outreach-sync): supabase client"
```

---

## Task 4: Webflow Client (TDD)

**Files:**
- Create: `lib/__tests__/outreach-webflow-client.test.ts`
- Create: `lib/sync/outreach/webflow-client.ts`

- [ ] **Step 4.1: Write the failing tests**

```typescript
// lib/__tests__/outreach-webflow-client.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OutreachWebflowClient } from "../sync/outreach/webflow-client";
import type { OutreachProject } from "../sync/outreach/types";

type RefCollectionIds = {
  campus: string;
  event: string;
  category: string;
  city: string;
};

const refIds: RefCollectionIds = {
  campus: "campus-col-id",
  event: "event-col-id",
  category: "category-col-id",
  city: "city-col-id",
};

let client: OutreachWebflowClient;

const baseProject: OutreachProject = {
  rock_group_id: 100,
  rock_opportunity_id: 200,
  rock_schedule_id: 300,
  name: "Feed My Starving Children",
  slug: "feed-my-starving-children",
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
};

beforeEach(() => {
  client = new OutreachWebflowClient(
    "test-token",
    "site-id",
    "collection-id",
    refIds
  );
  client.campusMap = { "Chandler Campus": "campus-wf-1" };
  client.eventMap = { "Serve Day": "event-wf-1" };
  client.categoryMap = { "Food Prep & Distribution": "cat-wf-1" };
  client.cityMap = { Tempe: "city-wf-1" };
});

describe("transformProjectForWebflow", () => {
  it("maps name, slug, and rock IDs", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["name"]).toBe("Feed My Starving Children");
    expect(fieldData["slug"]).toBe("feed-my-starving-children");
    expect(fieldData["rock-group-id"]).toBe(100);
    expect(fieldData["rock-opportunity-id"]).toBe(200);
  });

  it("maps schedule-display and location-address", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["schedule-display"]).toBe("Once at 7/11/2026 9:00 AM");
    expect(fieldData["location-address"]).toBe(
      "1100 W Grove Pkwy Ste 101, Tempe, AZ 85283"
    );
  });

  it("maps boolean switches for kids-welcome and handicap-accessible", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["kids-welcome"]).toBe(true);
    expect(fieldData["handicap-accessible"]).toBe(true);
  });

  it("maps false boolean switches correctly", () => {
    const project = { ...baseProject, kids_welcome: false, handicap_accessible: false };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData["kids-welcome"]).toBe(false);
    expect(fieldData["handicap-accessible"]).toBe(false);
  });

  it("maps signup-url", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["signup-url"]).toBe(
      "https://rms.spiritchurch.co/signups/register/abc/location/def/schedule/ghi"
    );
  });

  it("maps semester and project-type as plain text", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["semester"]).toBe("Fall 2026");
    expect(fieldData["project-type"]).toBe("In-Person");
  });

  it("maps campus reference ID from campusMap", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["campus"]).toBe("campus-wf-1");
  });

  it("maps event reference ID from eventMap", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["event"]).toBe("event-wf-1");
  });

  it("maps category reference ID from categoryMap", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["category"]).toBe("cat-wf-1");
  });

  it("maps city reference ID from cityMap", () => {
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData["city"]).toBe("city-wf-1");
  });

  it("omits campus when not in map", () => {
    client.campusMap = {};
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("campus");
  });

  it("omits campus when campusMap is null", () => {
    client.campusMap = null;
    const { fieldData } = client.transformProjectForWebflow(baseProject);
    expect(fieldData).not.toHaveProperty("campus");
  });

  it("omits description when empty string", () => {
    const project = { ...baseProject, description: "" };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData).not.toHaveProperty("description");
  });

  it("omits tools-needed when null", () => {
    const project = { ...baseProject, tools_needed: null };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData).not.toHaveProperty("tools-needed");
  });

  it("omits signup-url when null", () => {
    const project = { ...baseProject, signup_url: null };
    const { fieldData } = client.transformProjectForWebflow(project);
    expect(fieldData).not.toHaveProperty("signup-url");
  });
});

describe("deleteItem", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls DELETE on the correct endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    await client.deleteItem("item-123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.webflow.com/v2/collections/collection-id/items/item-123",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      })
    );

    await expect(client.deleteItem("item-999")).rejects.toThrow("404");
  });
});

describe("deleteItems", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns 0 for empty input without calling fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const count = await client.deleteItems([]);
    expect(count).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns count of successfully deleted items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );

    const count = await client.deleteItems(["id-1", "id-2", "id-3"]);
    expect(count).toBe(3);
  });

  it("skips failed deletes and returns count of successes only", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Server Error",
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);

    const count = await client.deleteItems(["id-1", "id-2", "id-3"]);
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/outreach-webflow-client.test.ts
```

Expected: FAIL with `Cannot find module '../sync/outreach/webflow-client'`

- [ ] **Step 4.3: Implement webflow-client**

```typescript
// lib/sync/outreach/webflow-client.ts
import type { OutreachProject, WebflowOutreachItem } from "./types";
import { log, logError } from "../utils";

type ReferenceMap = Record<string, string>;

type RefCollectionIds = {
  campus: string;
  event: string;
  category: string;
  city: string;
};

export class OutreachWebflowClient {
  private apiToken: string;
  private siteId: string;
  private collectionId: string;
  private refCollectionIds: RefCollectionIds;
  private baseUrl = "https://api.webflow.com/v2";

  campusMap: ReferenceMap | null = null;
  eventMap: ReferenceMap | null = null;
  categoryMap: ReferenceMap | null = null;
  cityMap: ReferenceMap | null = null;

  constructor(
    apiToken: string,
    siteId: string,
    collectionId: string,
    refCollectionIds: RefCollectionIds
  ) {
    this.apiToken = apiToken;
    this.siteId = siteId;
    this.collectionId = collectionId;
    this.refCollectionIds = refCollectionIds;
  }

  private get authHeaders() {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  async fetchReferenceCollection(collectionId: string): Promise<ReferenceMap> {
    const response = await fetch(
      `${this.baseUrl}/collections/${collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch reference collection ${collectionId}: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    const map: ReferenceMap = {};
    for (const item of data.items ?? []) {
      const name = item.fieldData?.name || item.fieldData?.Name;
      if (name) map[name] = item.id;
    }
    return map;
  }

  async initializeReferenceMaps(): Promise<void> {
    log("Initializing outreach reference collection mappings...");

    const [campus, event, category, city] = await Promise.all([
      this.fetchReferenceCollection(this.refCollectionIds.campus),
      this.fetchReferenceCollection(this.refCollectionIds.event),
      this.fetchReferenceCollection(this.refCollectionIds.category),
      this.fetchReferenceCollection(this.refCollectionIds.city),
    ]);

    this.campusMap = campus;
    this.eventMap = event;
    this.categoryMap = category;
    this.cityMap = city;

    log(
      `Loaded ${Object.keys(campus).length} campuses, ` +
        `${Object.keys(event).length} events, ` +
        `${Object.keys(category).length} categories, ` +
        `${Object.keys(city).length} cities`
    );
  }

  mapNameToId(name: string | null, map: ReferenceMap | null): string | null {
    if (!name || !map) return null;
    const id = map[name];
    if (!id) {
      log(`Warning: No matching Webflow item for value: ${name}`);
      return null;
    }
    return id;
  }

  transformProjectForWebflow(
    project: OutreachProject
  ): { fieldData: Record<string, unknown> } {
    const fieldData: Record<string, unknown> = {
      name: project.name,
      slug: project.slug,
      "rock-group-id": project.rock_group_id,
      "rock-opportunity-id": project.rock_opportunity_id,
      "kids-welcome": project.kids_welcome,
      "handicap-accessible": project.handicap_accessible,
      "is-active": project.is_active,
    };

    if (project.description) fieldData["description"] = project.description;
    if (project.schedule_display) fieldData["schedule-display"] = project.schedule_display;
    if (project.location_address) fieldData["location-address"] = project.location_address;
    if (project.semester) fieldData["semester"] = project.semester;
    if (project.tools_needed) fieldData["tools-needed"] = project.tools_needed;
    if (project.project_type) fieldData["project-type"] = project.project_type;
    if (project.signup_url) fieldData["signup-url"] = project.signup_url;

    try {
      const campusId = this.mapNameToId(project.campus, this.campusMap);
      if (campusId) fieldData["campus"] = campusId;
    } catch (e) {
      log(`Warning: campus mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      const eventId = this.mapNameToId(project.event, this.eventMap);
      if (eventId) fieldData["event"] = eventId;
    } catch (e) {
      log(`Warning: event mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      const categoryId = this.mapNameToId(project.category, this.categoryMap);
      if (categoryId) fieldData["category"] = categoryId;
    } catch (e) {
      log(`Warning: category mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      const cityId = this.mapNameToId(project.city, this.cityMap);
      if (cityId) fieldData["city"] = cityId;
    } catch (e) {
      log(`Warning: city mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    return { fieldData };
  }

  async getExistingItems(): Promise<WebflowOutreachItem[]> {
    log("Fetching existing outreach items from Webflow...");

    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webflow API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const items: WebflowOutreachItem[] = data.items ?? [];
    if (data.pagination?.total != null && data.pagination.total > items.length) {
      log(
        `Warning: Webflow has ${data.pagination.total} total items but only ${items.length} were retrieved. Pagination not implemented.`
      );
    }
    log(`Retrieved ${items.length} existing Webflow outreach items`);
    return items;
  }

  async createItems(
    projects: OutreachProject[]
  ): Promise<{ created: number; itemIds: string[] }> {
    if (projects.length === 0) return { created: 0, itemIds: [] };

    log(`Creating ${projects.length} new outreach items in Webflow...`);

    let created = 0;
    const itemIds: string[] = [];

    for (const project of projects) {
      const payload = this.transformProjectForWebflow(project);

      const response = await fetch(
        `${this.baseUrl}/collections/${this.collectionId}/items`,
        {
          method: "POST",
          headers: this.authHeaders,
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logError(
          `Failed to create item ${project.name}`,
          new Error(errorText)
        );
        continue;
      }

      const data = await response.json();
      if (data.id) {
        itemIds.push(data.id);
        created++;
        log(`Created ${created}/${projects.length}: ${project.name}`);
      } else {
        logError(
          `Create succeeded but no id in response for ${project.name}`,
          new Error(JSON.stringify(data))
        );
      }

      if (created < projects.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Created ${created} outreach items`);
    return { created, itemIds };
  }

  async updateItem(itemId: string, project: OutreachProject): Promise<void> {
    const payload = this.transformProjectForWebflow(project);

    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionId}/items/${itemId}`,
      {
        method: "PATCH",
        headers: this.authHeaders,
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update item ${itemId}: ${errorText}`);
    }
  }

  async publishItems(itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;

    log(`Publishing ${itemIds.length} outreach items...`);

    const CHUNK_SIZE = 100;
    for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
      const chunk = itemIds.slice(i, i + CHUNK_SIZE);

      const response = await fetch(
        `${this.baseUrl}/collections/${this.collectionId}/items/publish`,
        {
          method: "POST",
          headers: this.authHeaders,
          body: JSON.stringify({ itemIds: chunk }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to publish items (chunk ${Math.floor(i / CHUNK_SIZE) + 1}): ${response.status} - ${errorText}`
        );
      }
    }

    log(`Published ${itemIds.length} outreach items`);
  }

  async publishSite(): Promise<void> {
    log("Publishing Webflow site (outreach sync)...");

    const siteResponse = await fetch(`${this.baseUrl}/sites/${this.siteId}`, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        accept: "application/json",
      },
    });

    let customDomains: string[] = [];
    if (siteResponse.ok) {
      const siteData = await siteResponse.json();
      customDomains =
        siteData.customDomains?.map((d: { url: string }) => d.url) ?? [];
    }

    const response = await fetch(
      `${this.baseUrl}/sites/${this.siteId}/publish`,
      {
        method: "POST",
        headers: this.authHeaders,
        body: JSON.stringify({ customDomains }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to publish site: ${response.status} - ${errorText}`
      );
    }

    log("Site published");
  }

  async deleteItem(itemId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionId}/items/${itemId}`,
      {
        method: "DELETE",
        headers: this.authHeaders,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to delete item ${itemId}: ${response.status} - ${errorText}`
      );
    }
  }

  async deleteItems(itemIds: string[]): Promise<number> {
    if (itemIds.length === 0) return 0;

    log(`Deleting ${itemIds.length} outreach items from Webflow...`);

    let deleted = 0;
    for (let i = 0; i < itemIds.length; i++) {
      try {
        await this.deleteItem(itemIds[i]);
        deleted++;
      } catch (e) {
        logError(`Failed to delete item ${itemIds[i]}`, e as Error);
      }
      if (i < itemIds.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Deleted ${deleted} outreach items`);
    return deleted;
  }
}
```

- [ ] **Step 4.4: Run tests to verify they pass**

```bash
npx vitest run lib/__tests__/outreach-webflow-client.test.ts
```

Expected: All tests PASS

- [ ] **Step 4.5: Commit**

```bash
git add lib/__tests__/outreach-webflow-client.test.ts lib/sync/outreach/webflow-client.ts
git commit -m "feat(outreach-sync): webflow client with TDD"
```

---

## Task 5: Orchestrator

**Files:**
- Create: `lib/sync/outreach/index.ts`

- [ ] **Step 5.1: Implement fullOutreachSync**

```typescript
// lib/sync/outreach/index.ts
import type { OutreachSyncEnv, OutreachSyncStats } from "./types";
import { OutreachRockClient } from "./rock-client";
import { OutreachSupabaseClient } from "./supabase-client";
import { OutreachWebflowClient } from "./webflow-client";
import { log, logError } from "../utils";

export async function fullOutreachSync(
  env: OutreachSyncEnv
): Promise<OutreachSyncStats> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  const rock = new OutreachRockClient(
    env.ROCK_API_URL,
    env.ROCK_REST_KEY,
    parseInt(env.ROCK_SIGNUP_GROUP_TYPE_ID, 10)
  );
  const supabase = new OutreachSupabaseClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY
  );
  const webflow = new OutreachWebflowClient(
    env.WEBFLOW_API_TOKEN,
    env.WEBFLOW_SITE_ID,
    env.WEBFLOW_OUTREACH_COLLECTION_ID,
    {
      campus: env.WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID,
      event: env.WEBFLOW_OUTREACH_EVENT_COLLECTION_ID,
      category: env.WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID,
      city: env.WEBFLOW_OUTREACH_CITY_COLLECTION_ID,
    }
  );

  const duration = () => Math.round((Date.now() - startTime) / 1000);

  try {
    // Stage 1: Rock RMS → Supabase
    log("--- Outreach Stage 1: Rock RMS → Supabase ---");
    const rockProjects = await rock.fetchSignUpGroups();

    const toDelete = rockProjects.filter((p) => p.is_archived);
    const activeProjects = rockProjects.filter((p) => !p.is_archived);
    log(
      `${activeProjects.length} active projects, ${toDelete.length} archived to delete`
    );

    await supabase.upsertProjects(activeProjects);
    if (toDelete.length > 0) {
      await supabase.deleteProjects(toDelete.map((p) => p.rock_group_id));
    }
    await supabase.logSync("outreach_rock_to_supabase", "success", {
      processed: activeProjects.length,
      startedAt,
      duration: duration(),
    });

    // Stage 2: Supabase → Webflow (create + update + delete)
    log("--- Outreach Stage 2: Supabase → Webflow ---");
    await webflow.initializeReferenceMaps();

    const supabaseProjects = await supabase.getAllProjects();
    const existingItems = await webflow.getExistingItems();

    const existingMap = new Map(
      existingItems.map((item) => [
        item.fieldData["rock-opportunity-id"] as number,
        item,
      ])
    );

    const toCreate = supabaseProjects.filter(
      (p) => !existingMap.has(p.rock_opportunity_id)
    );
    const toUpdate = supabaseProjects
      .filter((p) => existingMap.has(p.rock_opportunity_id))
      .map((p) => ({ item: existingMap.get(p.rock_opportunity_id)!, project: p }));

    log(
      `${toCreate.length} to create, ${toUpdate.length} to update, ${toDelete.length} to delete from Webflow`
    );

    const { created, itemIds: createdIds } = await webflow.createItems(toCreate);

    const updatedIds: string[] = [];
    let updated = 0;
    for (const { item, project } of toUpdate) {
      try {
        await webflow.updateItem(item.id, project);
        updatedIds.push(item.id);
        updated++;
        if (updated % 10 === 0) log(`Updated ${updated}/${toUpdate.length}`);
      } catch (updateError) {
        logError(
          `Failed to update item ${item.id} (${project.name})`,
          updateError as Error
        );
      }
      if (updated < toUpdate.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const toDeleteWebflowIds = toDelete
      .map((p) => existingMap.get(p.rock_opportunity_id)?.id)
      .filter((id): id is string => id !== undefined);
    const deleted = await webflow.deleteItems(toDeleteWebflowIds);

    // Stage 3: Publish
    log("--- Outreach Stage 3: Publish ---");
    const allAffectedIds = [...createdIds, ...updatedIds];

    let published = 0;
    try {
      await webflow.publishItems(allAffectedIds);
      published = allAffectedIds.length;
      await webflow.publishSite();
    } catch (publishError) {
      logError(
        "Publish failed — items written but not yet published",
        publishError as Error
      );
      log("Publish manually via Webflow dashboard or wait for next sync");
    }

    await supabase.logSync("outreach_supabase_to_webflow", "success", {
      processed: supabaseProjects.length,
      created,
      updated,
      startedAt,
      duration: duration(),
    });

    log(`=== Outreach sync completed in ${duration()}s ===`);

    return {
      startedAt,
      rockToSupabase: { processed: activeProjects.length, status: "success" },
      supabaseToWebflow: {
        processed: supabaseProjects.length,
        created,
        updated,
        deleted,
        published,
        status: "success",
      },
      duration: duration(),
    };
  } catch (error) {
    logError("Outreach sync failed", error as Error);

    try {
      await supabase.logSync(
        "outreach_full_sync",
        "failed",
        { startedAt, duration: duration() },
        error as Error
      );
    } catch (logErr) {
      console.error("Failed to log outreach sync error:", logErr);
    }

    throw error;
  }
}
```

- [ ] **Step 5.2: Commit**

```bash
git add lib/sync/outreach/index.ts
git commit -m "feat(outreach-sync): orchestrator"
```

---

## Task 6: Route Handler (TDD)

**Files:**
- Create: `lib/__tests__/outreach-sync-route.test.ts`
- Create: `app/api/sync-outreach/route.ts`

- [ ] **Step 6.1: Write the failing tests**

```typescript
// lib/__tests__/outreach-sync-route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/sync/outreach", () => ({
  fullOutreachSync: vi.fn(),
}));

import { GET, POST } from "../../app/api/sync-outreach/route";
import { fullOutreachSync } from "@/lib/sync/outreach";

const mockFullOutreachSync = vi.mocked(fullOutreachSync);

const REQUIRED_ENV = {
  ROCK_API_URL: "https://rms.spiritchurch.co/api",
  ROCK_REST_KEY: "rock-key",
  ROCK_SIGNUP_GROUP_TYPE_ID: "42",
  SUPABASE_URL: "https://db.supabase.co",
  SUPABASE_SERVICE_KEY: "supa-key",
  WEBFLOW_API_TOKEN: "wf-token",
  WEBFLOW_SITE_ID: "site-id",
  WEBFLOW_OUTREACH_COLLECTION_ID: "col-id",
  WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID: "campus-id",
  WEBFLOW_OUTREACH_EVENT_COLLECTION_ID: "event-id",
  WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID: "cat-id",
  WEBFLOW_OUTREACH_CITY_COLLECTION_ID: "city-id",
  CRON_SECRET: "test-secret",
};

function makeRequest(method: string, authHeader?: string) {
  return new Request("https://example.com/api/sync-outreach", {
    method,
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    process.env[key] = value;
  }
  mockFullOutreachSync.mockResolvedValue({
    startedAt: "2026-06-09T00:00:00Z",
    rockToSupabase: { processed: 5, status: "success" },
    supabaseToWebflow: {
      processed: 5,
      created: 2,
      updated: 3,
      deleted: 0,
      published: 5,
      status: "success",
    },
    duration: 12,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(REQUIRED_ENV)) {
    delete process.env[key];
  }
});

describe("GET /api/sync-outreach", () => {
  it("returns 401 when authorization header is missing", async () => {
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 when token is wrong", async () => {
    const res = await GET(makeRequest("GET", "Bearer wrong-token"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with stats when authorized", async () => {
    const res = await GET(makeRequest("GET", "Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.stats.rockToSupabase.processed).toBe(5);
  });

  it("calls fullOutreachSync when authorized", async () => {
    await GET(makeRequest("GET", "Bearer test-secret"));
    expect(mockFullOutreachSync).toHaveBeenCalledOnce();
  });

  it("returns 500 when fullOutreachSync throws", async () => {
    mockFullOutreachSync.mockRejectedValue(new Error("Rock API down"));
    const res = await GET(makeRequest("GET", "Bearer test-secret"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Rock API down");
  });
});

describe("POST /api/sync-outreach", () => {
  it("returns 401 when authorization header is missing", async () => {
    const res = await POST(makeRequest("POST"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with stats when authorized", async () => {
    const res = await POST(makeRequest("POST", "Bearer test-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 6.2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/outreach-sync-route.test.ts
```

Expected: FAIL with `Cannot find module '../../app/api/sync-outreach/route'`

- [ ] **Step 6.3: Implement the route handler**

```typescript
// app/api/sync-outreach/route.ts
import { fullOutreachSync } from "@/lib/sync/outreach";
import type { OutreachSyncEnv } from "@/lib/sync/outreach/types";

function getEnv(): OutreachSyncEnv {
  const required = [
    "ROCK_API_URL",
    "ROCK_REST_KEY",
    "ROCK_SIGNUP_GROUP_TYPE_ID",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "WEBFLOW_API_TOKEN",
    "WEBFLOW_SITE_ID",
    "WEBFLOW_OUTREACH_COLLECTION_ID",
    "WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID",
    "WEBFLOW_OUTREACH_EVENT_COLLECTION_ID",
    "WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID",
    "WEBFLOW_OUTREACH_CITY_COLLECTION_ID",
    "CRON_SECRET",
  ] as const;

  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
  }

  return {
    ROCK_API_URL: process.env.ROCK_API_URL!,
    ROCK_REST_KEY: process.env.ROCK_REST_KEY!,
    ROCK_SIGNUP_GROUP_TYPE_ID: process.env.ROCK_SIGNUP_GROUP_TYPE_ID!,
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY!,
    WEBFLOW_API_TOKEN: process.env.WEBFLOW_API_TOKEN!,
    WEBFLOW_SITE_ID: process.env.WEBFLOW_SITE_ID!,
    WEBFLOW_OUTREACH_COLLECTION_ID: process.env.WEBFLOW_OUTREACH_COLLECTION_ID!,
    WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID:
      process.env.WEBFLOW_OUTREACH_CAMPUS_COLLECTION_ID!,
    WEBFLOW_OUTREACH_EVENT_COLLECTION_ID:
      process.env.WEBFLOW_OUTREACH_EVENT_COLLECTION_ID!,
    WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID:
      process.env.WEBFLOW_OUTREACH_CATEGORY_COLLECTION_ID!,
    WEBFLOW_OUTREACH_CITY_COLLECTION_ID:
      process.env.WEBFLOW_OUTREACH_CITY_COLLECTION_ID!,
    CRON_SECRET: process.env.CRON_SECRET!,
  };
}

function isAuthorized(request: Request): boolean {
  return (
    request.headers.get("authorization") ===
    `Bearer ${process.env.CRON_SECRET}`
  );
}

async function runSync() {
  const env = getEnv();
  const stats = await fullOutreachSync(env);
  return Response.json({ success: true, stats });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (error) {
    return Response.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6.4: Run tests to verify they pass**

```bash
npx vitest run lib/__tests__/outreach-sync-route.test.ts
```

Expected: All tests PASS

- [ ] **Step 6.5: Run full test suite to check for regressions**

```bash
npm test
```

Expected: All tests PASS

- [ ] **Step 6.6: Commit**

```bash
git add lib/__tests__/outreach-sync-route.test.ts app/api/sync-outreach/route.ts
git commit -m "feat(outreach-sync): route handler with TDD"
```

---

## Task 7: Cron Config + Deployment

**Files:**
- Modify: `vercel.json`

- [ ] **Step 7.1: Add cron entry to vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/sync-groups",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/sync-outreach",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

- [ ] **Step 7.2: Commit**

```bash
git add vercel.json
git commit -m "feat(outreach-sync): add cron for /api/sync-outreach"
```

- [ ] **Step 7.3: Deploy to production**

```bash
vercel build --prod && vercel deploy --prebuilt --prod
```

- [ ] **Step 7.4: Trigger a manual sync to verify end-to-end**

```bash
curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-outreach \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected response shape:
```json
{
  "success": true,
  "stats": {
    "rockToSupabase": { "processed": <N>, "status": "success" },
    "supabaseToWebflow": {
      "processed": <N>,
      "created": <N>,
      "updated": 0,
      "deleted": 0,
      "published": <N>,
      "status": "success"
    }
  }
}
```

If `processed: 0` on the first run, the Rock API expand query or GroupTypeId is likely wrong — re-run the diagnostic curl from Task 0 Step 5 and verify.

If sign-up URLs are `null` for all items, IdKey is not returned by the API — see the fallback note in `types.ts` and implement `fetchIdKey` in `rock-client.ts`.

---

## Post-Deploy Checklist

- [ ] Verify outreach items appear in Webflow CMS (not as drafts)
- [ ] Verify reference field values (campus, event, category, city) are populated
- [ ] Click a sign-up URL to confirm it lands on the correct Rock RMS registration page
- [ ] Confirm Webflow cron fires on next 6-hour interval (check Vercel dashboard → Functions → Cron)
- [ ] Update `docs/Development/groups-sync.md` with a session entry for the new Outreach pipeline (or create `docs/Development/outreach-sync.md`)
