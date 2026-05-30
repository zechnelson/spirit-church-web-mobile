# Groups Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Rock RMS → Supabase → Webflow CMS groups sync from a Cloudflare Worker into this Next.js app, and fix the publishing bug where synced items remain as drafts.

**Architecture:** The sync logic moves into `lib/sync/` as a set of TypeScript classes. A Next.js Route Handler at `app/api/sync-groups/route.ts` exposes the sync as an HTTP endpoint. A Vercel Cron job in `vercel.json` calls that endpoint every 6 hours.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Vercel Cron, Webflow v2 API, Supabase REST API, Rock RMS REST API.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/sync/types.ts` | Shared TypeScript interfaces |
| Create | `lib/sync/utils.ts` | Pure utility functions |
| Create | `lib/sync/rock-client.ts` | Rock RMS API client + group transform |
| Create | `lib/sync/supabase-client.ts` | Supabase upsert + log client |
| Create | `lib/sync/webflow-client.ts` | Webflow CMS client + publishing fix |
| Create | `lib/sync/index.ts` | `fullSync()` orchestrator |
| Create | `app/api/sync-groups/route.ts` | Route Handler (GET + POST) |
| Create | `vercel.json` | Cron schedule config |
| Create | `.env.local.example` | Env var documentation |
| Create | `lib/__tests__/sync-utils.test.ts` | Utility function tests |
| Create | `lib/__tests__/rock-client.test.ts` | Transform tests |
| Create | `lib/__tests__/webflow-client.test.ts` | Transform + mapping tests |
| Modify | `vitest.config.ts` | Add `@/` path alias for route tests |

---

## Task 1: Shared Type Definitions

**Files:**
- Create: `lib/sync/types.ts`

- [ ] **Step 1: Create `lib/sync/types.ts`**

```typescript
export interface AttributeValue {
  Value?: string;
  ValueFormatted?: string;
}

export interface RockRawGroup {
  Id: number;
  Name: string;
  Description?: string;
  GroupTypeId: number;
  ParentGroupId?: number;
  CampusId?: number;
  IsActive: boolean;
  IsPublic: boolean;
  GroupCapacity?: number;
  ActiveMemberCount?: number;
  Campus?: { Name: string };
  GroupType?: { Name: string };
  Schedule?: {
    WeeklyDayOfWeek?: number;
    WeeklyTimeOfDay?: string;
    Description?: string;
  };
  AttributeValues?: {
    Topic?: AttributeValue;
    SpiritGroupAudience?: AttributeValue;
    SpiritGroupLifeStage?: AttributeValue;
    SpiritGroupLocation?: AttributeValue;
    ChildcareProvided?: AttributeValue;
    AreKidsWelcome?: AttributeValue;
    GroupImageThumbnail?: AttributeValue;
  };
}

export interface SyncGroup {
  rock_id: number;
  name: string;
  slug: string;
  description: string;
  campus: string | null;
  campus_id: number | null;
  group_type: string | null;
  group_type_id: number | null;
  parent_group_id: number | null;
  meeting_time: string | null;
  schedule_description: string | null;
  capacity: number | null;
  current_members: number;
  registration_url: string;
  is_active: boolean;
  is_public: boolean;
  topics: string[];
  audience: string[];
  life_stages: string[];
  city: string | null;
  childcare_provided: string | null;
  kids_welcome: string | null;
  group_image: string | null;
  last_synced_at: string;
}

export interface WebflowItem {
  id: string;
  fieldData: Record<string, unknown>;
}

export interface SyncEnv {
  ROCK_API_URL: string;
  ROCK_REST_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  WEBFLOW_API_TOKEN: string;
  WEBFLOW_SITE_ID: string;
  WEBFLOW_COLLECTION_ID: string;
  CRON_SECRET: string;
}

export interface SyncStats {
  startedAt: string;
  rockToSupabase: { processed: number; status: string };
  supabaseToWebflow: {
    processed: number;
    created: number;
    updated: number;
    published: number;
    status: string;
  };
  duration: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/sync/types.ts
git commit -m "feat: sync type definitions"
```

---

## Task 2: Utility Functions (TDD)

**Files:**
- Create: `lib/sync/utils.ts`
- Create: `lib/__tests__/sync-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/__tests__/sync-utils.test.ts
import { describe, it, expect } from "vitest";
import {
  slugify,
  convertTo12Hour,
  calculateSpotsAvailable,
  parseMultiSelectAttribute,
  getImageUrl,
} from "../sync/utils";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Life Groups Downtown")).toBe("life-groups-downtown");
  });
  it("strips special characters", () => {
    expect(slugify("Men's Group")).toBe("mens-group");
  });
  it("collapses multiple hyphens", () => {
    expect(slugify("Group  --  Name")).toBe("group-name");
  });
  it("strips leading and trailing whitespace", () => {
    expect(slugify("  Test  ")).toBe("test");
  });
});

describe("convertTo12Hour", () => {
  it("converts 18:00:00 to 6:00 PM", () => {
    expect(convertTo12Hour("18:00:00")).toBe("6:00 PM");
  });
  it("converts 09:30:00 to 9:30 AM", () => {
    expect(convertTo12Hour("09:30:00")).toBe("9:30 AM");
  });
  it("converts 00:00:00 to 12:00 AM (midnight)", () => {
    expect(convertTo12Hour("00:00:00")).toBe("12:00 AM");
  });
  it("converts 12:00:00 to 12:00 PM (noon)", () => {
    expect(convertTo12Hour("12:00:00")).toBe("12:00 PM");
  });
  it("returns null for null input", () => {
    expect(convertTo12Hour(null)).toBeNull();
  });
});

describe("calculateSpotsAvailable", () => {
  it("returns capacity minus current members", () => {
    expect(calculateSpotsAvailable(20, 12)).toBe(8);
  });
  it("returns 0 when over capacity", () => {
    expect(calculateSpotsAvailable(10, 15)).toBe(0);
  });
  it("returns null when no capacity set", () => {
    expect(calculateSpotsAvailable(null, 5)).toBeNull();
  });
  it("treats null members as 0", () => {
    expect(calculateSpotsAvailable(10, null)).toBe(10);
  });
});

describe("parseMultiSelectAttribute", () => {
  it("splits ValueFormatted by comma", () => {
    expect(
      parseMultiSelectAttribute({ ValueFormatted: "Prayer, Bible Study" })
    ).toEqual(["Prayer", "Bible Study"]);
  });
  it("falls back to Value when no ValueFormatted", () => {
    expect(parseMultiSelectAttribute({ Value: "guid1,guid2" })).toEqual([
      "guid1",
      "guid2",
    ]);
  });
  it("returns empty array for undefined input", () => {
    expect(parseMultiSelectAttribute(undefined)).toEqual([]);
  });
  it("filters empty strings after split", () => {
    expect(
      parseMultiSelectAttribute({ ValueFormatted: "Prayer," })
    ).toEqual(["Prayer"]);
  });
});

describe("getImageUrl", () => {
  it("builds URL from GUID", () => {
    expect(
      getImageUrl({ Value: "abc-123" }, "https://rms.example.com/api")
    ).toBe("https://rms.example.com/GetImage.ashx?guid=abc-123");
  });
  it("strips /api suffix from base URL", () => {
    expect(
      getImageUrl({ Value: "abc-123" }, "https://rms.example.com/api")
    ).not.toContain("/api/GetImage");
  });
  it("returns null when Value is missing", () => {
    expect(getImageUrl({ Value: "" }, "https://rms.example.com/api")).toBeNull();
  });
  it("returns null for undefined input", () => {
    expect(getImageUrl(undefined, "https://rms.example.com/api")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- sync-utils
```

Expected: FAIL with `Cannot find module '../sync/utils'`

- [ ] **Step 3: Implement `lib/sync/utils.ts`**

```typescript
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function calculateSpotsAvailable(
  capacity: number | null,
  currentMembers: number | null
): number | null {
  if (capacity == null) return null;
  return Math.max(0, capacity - (currentMembers ?? 0));
}

export function log(message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

export function logError(message: string, error: Error): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`, {
    message: error.message,
    stack: error.stack,
  });
}

export function convertTo12Hour(time24: string | null): string | null {
  if (!time24) return null;
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  let hours12 = hours % 12;
  if (hours12 === 0) hours12 = 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

export function parseMultiSelectAttribute(
  attributeValue: { Value?: string; ValueFormatted?: string } | undefined
): string[] {
  if (!attributeValue) return [];
  const source = attributeValue.ValueFormatted ?? attributeValue.Value ?? "";
  return source
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function getImageUrl(
  attributeValue: { Value?: string } | undefined,
  rockApiUrl: string
): string | null {
  if (!attributeValue?.Value) return null;
  const baseUrl = rockApiUrl.replace(/\/api\/?$/, "");
  return `${baseUrl}/GetImage.ashx?guid=${attributeValue.Value}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- sync-utils
```

Expected: All 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/sync/utils.ts lib/__tests__/sync-utils.test.ts
git commit -m "feat: sync utility functions with tests"
```

---

## Task 3: Rock RMS Client (TDD)

**Files:**
- Create: `lib/sync/rock-client.ts`
- Create: `lib/__tests__/rock-client.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/__tests__/rock-client.test.ts
import { describe, it, expect } from "vitest";
import { RockRMSClient } from "../sync/rock-client";

const client = new RockRMSClient("https://rms.spiritchurch.co/api", "test-key");

describe("transformGroup", () => {
  it("maps basic fields correctly", () => {
    const raw = {
      Id: 42,
      Name: "Downtown Life Group",
      Description: "A great group",
      GroupTypeId: 25,
      ParentGroupId: 85,
      CampusId: 1,
      IsActive: true,
      IsPublic: true,
      GroupCapacity: 20,
      ActiveMemberCount: 8,
      Campus: { Name: "Downtown" },
      GroupType: { Name: "Spirit Group" },
      Schedule: { WeeklyTimeOfDay: "18:00:00", Description: "Tuesdays at 6pm" },
      AttributeValues: {},
    };

    const result = client.transformGroup(raw);

    expect(result.rock_id).toBe(42);
    expect(result.name).toBe("Downtown Life Group");
    expect(result.slug).toBe("downtown-life-group");
    expect(result.meeting_time).toBe("6:00 PM");
    expect(result.schedule_description).toBe("Tuesdays at 6pm");
    expect(result.registration_url).toBe(
      "https://rms.spiritchurch.co/GroupRegistration?GroupId=42"
    );
    expect(result.current_members).toBe(8);
    expect(result.topics).toEqual([]);
    expect(result.audience).toEqual([]);
    expect(result.life_stages).toEqual([]);
  });

  it("extracts multi-select topics from ValueFormatted", () => {
    const raw = {
      Id: 1,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
      AttributeValues: { Topic: { ValueFormatted: "Prayer, Bible Study" } },
    };
    expect(client.transformGroup(raw).topics).toEqual(["Prayer", "Bible Study"]);
  });

  it("takes only first city value", () => {
    const raw = {
      Id: 1,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
      AttributeValues: {
        SpiritGroupLocation: { ValueFormatted: "Phoenix, Tempe" },
      },
    };
    expect(client.transformGroup(raw).city).toBe("Phoenix");
  });

  it("returns null meeting_time when schedule is absent", () => {
    const raw = {
      Id: 1,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
    };
    expect(client.transformGroup(raw).meeting_time).toBeNull();
  });

  it("defaults current_members to 0 when absent", () => {
    const raw = {
      Id: 1,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
    };
    expect(client.transformGroup(raw).current_members).toBe(0);
  });

  it("sets registration_url using group Id", () => {
    const raw = {
      Id: 99,
      Name: "Test",
      Description: "",
      GroupTypeId: 25,
      IsActive: true,
      IsPublic: true,
    };
    expect(client.transformGroup(raw).registration_url).toContain("GroupId=99");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- rock-client
```

Expected: FAIL with `Cannot find module '../sync/rock-client'`

- [ ] **Step 3: Implement `lib/sync/rock-client.ts`**

```typescript
import type { RockRawGroup, SyncGroup } from "./types";
import {
  slugify,
  convertTo12Hour,
  parseMultiSelectAttribute,
  getImageUrl,
  log,
  logError,
} from "./utils";

export class RockRMSClient {
  private apiUrl: string;
  private restKey: string;

  constructor(apiUrl: string, restKey: string) {
    this.apiUrl =
      apiUrl.replace("/api/v2", "").replace(/\/api$/, "") + "/api";
    this.restKey = restKey;
  }

  async fetchGroups(): Promise<SyncGroup[]> {
    log("Fetching groups from Rock RMS (recursive from parent 85)...");
    const allGroups = await this.fetchGroupDescendants(85);
    log(`Fetched ${allGroups.length} total groups`);

    const spiritGroups = allGroups.filter((g) => g.GroupTypeId === 25);
    log(`Filtered to ${spiritGroups.length} Spirit Groups`);

    return spiritGroups.map((g) => this.transformGroup(g));
  }

  async fetchGroupDescendants(parentId: number): Promise<RockRawGroup[]> {
    const query = new URLSearchParams({
      $filter: `ParentGroupId eq ${parentId}`,
      $expand: "Campus,GroupType,Schedule",
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

    const children: RockRawGroup[] = await response.json();
    log(`Found ${children.length} children of group ${parentId}`);

    const descendants: RockRawGroup[] = [...children];
    for (const child of children) {
      const grandchildren = await this.fetchGroupDescendants(child.Id);
      descendants.push(...grandchildren);
    }
    return descendants;
  }

  transformGroup(rockGroup: RockRawGroup): SyncGroup {
    const topics = parseMultiSelectAttribute(rockGroup.AttributeValues?.Topic);
    const audience = parseMultiSelectAttribute(
      rockGroup.AttributeValues?.SpiritGroupAudience
    );
    const lifeStages = parseMultiSelectAttribute(
      rockGroup.AttributeValues?.SpiritGroupLifeStage
    );
    const cityArray = parseMultiSelectAttribute(
      rockGroup.AttributeValues?.SpiritGroupLocation
    );

    return {
      rock_id: rockGroup.Id,
      name: rockGroup.Name,
      slug: slugify(rockGroup.Name),
      description: rockGroup.Description ?? "",
      campus: rockGroup.Campus?.Name ?? null,
      campus_id: rockGroup.CampusId ?? null,
      group_type: rockGroup.GroupType?.Name ?? null,
      group_type_id: rockGroup.GroupTypeId ?? null,
      parent_group_id: rockGroup.ParentGroupId ?? null,
      meeting_time: rockGroup.Schedule?.WeeklyTimeOfDay
        ? convertTo12Hour(rockGroup.Schedule.WeeklyTimeOfDay)
        : null,
      schedule_description: rockGroup.Schedule?.Description ?? null,
      capacity: rockGroup.GroupCapacity ?? null,
      current_members: rockGroup.ActiveMemberCount ?? 0,
      registration_url: `https://rms.spiritchurch.co/GroupRegistration?GroupId=${rockGroup.Id}`,
      is_active: rockGroup.IsActive,
      is_public: rockGroup.IsPublic,
      topics,
      audience,
      life_stages: lifeStages,
      city: cityArray[0] ?? null,
      childcare_provided:
        rockGroup.AttributeValues?.ChildcareProvided?.Value ?? null,
      kids_welcome: rockGroup.AttributeValues?.AreKidsWelcome?.Value ?? null,
      group_image: getImageUrl(
        rockGroup.AttributeValues?.GroupImageThumbnail,
        this.apiUrl
      ),
      last_synced_at: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- rock-client
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/sync/rock-client.ts lib/__tests__/rock-client.test.ts
git commit -m "feat: Rock RMS client with transform tests"
```

---

## Task 4: Supabase Client

**Files:**
- Create: `lib/sync/supabase-client.ts`

The Supabase client is all HTTP calls with no pure logic to unit-test in isolation. Correctness is validated by the running sync in Task 8.

- [ ] **Step 1: Create `lib/sync/supabase-client.ts`**

```typescript
import type { SyncGroup } from "./types";
import { log, logError } from "./utils";

export class SupabaseClient {
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

  async upsertGroups(groups: SyncGroup[]): Promise<SyncGroup[]> {
    log(`Upserting ${groups.length} groups to Supabase...`);

    const payload = groups.map((g) => ({
      ...g,
      updated_at: new Date().toISOString(),
    }));

    const response = await fetch(`${this.url}/rest/v1/groups`, {
      method: "POST",
      headers: {
        ...this.headers,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase upsert failed: ${response.status} - ${errorText}`);
    }

    const result: SyncGroup[] = await response.json();
    log(`Upserted ${result.length} groups`);
    return result;
  }

  async getAllGroups(): Promise<SyncGroup[]> {
    log("Fetching all groups from Supabase...");

    const response = await fetch(`${this.url}/rest/v1/groups?order=name.asc`, {
      headers: this.headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase fetch failed: ${response.status} - ${errorText}`);
    }

    const groups: SyncGroup[] = await response.json();
    log(`Retrieved ${groups.length} groups`);
    return groups;
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

- [ ] **Step 2: Commit**

```bash
git add lib/sync/supabase-client.ts
git commit -m "feat: Supabase client"
```

---

## Task 5: Webflow Client with Publishing Fix (TDD)

**Files:**
- Create: `lib/sync/webflow-client.ts`
- Create: `lib/__tests__/webflow-client.test.ts`

The publishing fix is in `publishItems()` — a new method that calls `POST /collections/{id}/items/publish` with the IDs of all items created or updated in a sync run. `createItems()` is updated to return created item IDs from API responses.

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/__tests__/webflow-client.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { WebflowClient } from "../sync/webflow-client";
import type { SyncGroup } from "../sync/types";

let client: WebflowClient;

const baseGroup: SyncGroup = {
  rock_id: 42,
  name: "Test Group",
  slug: "test-group",
  description: "A group",
  campus: "Downtown",
  campus_id: 1,
  group_type: "Spirit Group",
  group_type_id: 25,
  parent_group_id: 85,
  meeting_time: "6:00 PM",
  schedule_description: "Tuesdays at 6pm",
  capacity: 20,
  current_members: 8,
  registration_url: "https://rms.spiritchurch.co/GroupRegistration?GroupId=42",
  is_active: true,
  is_public: true,
  topics: ["Prayer"],
  audience: ["Men"],
  life_stages: ["Young Adults"],
  city: "Phoenix",
  childcare_provided: "Yes",
  kids_welcome: "No",
  group_image: null,
  last_synced_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  client = new WebflowClient("test-token", "site-id", "collection-id");
  client.topicsMap = { Prayer: "topic-1", "Bible Study": "topic-2" };
  client.audiencesMap = { Men: "aud-1", Women: "aud-2" };
  client.lifeStagesMap = { "Young Adults": "ls-1" };
  client.cityMap = { Phoenix: "city-1", Tempe: "city-2" };
  client.childcareMap = { Yes: "cc-yes", No: "cc-no" };
  client.kidsWelcomeMap = { Yes: "kw-yes", No: "kw-no" };
});

describe("transformGroupForWebflow", () => {
  it("maps name, slug, and rock-id", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["name"]).toBe("Test Group");
    expect(fieldData["slug"]).toBe("test-group");
    expect(fieldData["rock-id"]).toBe(42);
  });

  it("calculates spots-available as capacity minus members", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["spots-available"]).toBe(12);
  });

  it("maps topics array to Webflow item IDs", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["group-topics"]).toEqual(["topic-1"]);
  });

  it("maps city to a single Webflow item ID string", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["city"]).toBe("city-1");
  });

  it("maps childcare to single reference ID", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData["childcare-available"]).toBe("cc-yes");
  });

  it("does NOT include meeting-days field", () => {
    const { fieldData } = client.transformGroupForWebflow(baseGroup);
    expect(fieldData).not.toHaveProperty("meeting-days");
  });

  it("omits optional fields when null or empty string", () => {
    const group: SyncGroup = {
      ...baseGroup,
      description: "",
      campus: null,
      meeting_time: null,
    };
    const { fieldData } = client.transformGroupForWebflow(group);
    expect(fieldData).not.toHaveProperty("description-2");
    expect(fieldData).not.toHaveProperty("campus-2");
    expect(fieldData).not.toHaveProperty("meeting-time");
  });
});

describe("mapValuesToIds", () => {
  it("returns IDs for known values", () => {
    expect(
      client.mapValuesToIds(["Prayer", "Bible Study"], client.topicsMap!)
    ).toEqual(["topic-1", "topic-2"]);
  });

  it("skips unrecognized values silently", () => {
    expect(client.mapValuesToIds(["Unknown"], client.topicsMap!)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(client.mapValuesToIds([], client.topicsMap!)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- webflow-client
```

Expected: FAIL with `Cannot find module '../sync/webflow-client'`

- [ ] **Step 3: Implement `lib/sync/webflow-client.ts`**

```typescript
import type { SyncGroup, WebflowItem } from "./types";
import { calculateSpotsAvailable, log, logError } from "./utils";

type ReferenceMap = Record<string, string>;

export class WebflowClient {
  private apiToken: string;
  private siteId: string;
  private collectionId: string;
  private baseUrl = "https://api.webflow.com/v2";

  private readonly topicsCollectionId = "696eff5aa4cda76f8c6de386";
  private readonly audiencesCollectionId = "696eff2807ed1fc6a1eb8db0";
  private readonly lifeStagesCollectionId = "696eff96dbc04d12d51b34e1";
  private readonly cityCollectionId = "6970957a11505bf2aa488045";
  private readonly childcareCollectionId = "69719d2a11b310551fda1713";
  private readonly kidsWelcomeCollectionId = "69719e7b17501e7b8c9e9179";

  // Public so tests can inject maps directly without hitting the API
  topicsMap: ReferenceMap | null = null;
  audiencesMap: ReferenceMap | null = null;
  lifeStagesMap: ReferenceMap | null = null;
  cityMap: ReferenceMap | null = null;
  childcareMap: ReferenceMap | null = null;
  kidsWelcomeMap: ReferenceMap | null = null;

  constructor(apiToken: string, siteId: string, collectionId: string) {
    this.apiToken = apiToken;
    this.siteId = siteId;
    this.collectionId = collectionId;
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
    log("Initializing reference collection mappings...");

    const [topics, audiences, lifeStages, city, childcare, kidsWelcome] =
      await Promise.all([
        this.fetchReferenceCollection(this.topicsCollectionId),
        this.fetchReferenceCollection(this.audiencesCollectionId),
        this.fetchReferenceCollection(this.lifeStagesCollectionId),
        this.fetchReferenceCollection(this.cityCollectionId),
        this.fetchReferenceCollection(this.childcareCollectionId),
        this.fetchReferenceCollection(this.kidsWelcomeCollectionId),
      ]);

    this.topicsMap = topics;
    this.audiencesMap = audiences;
    this.lifeStagesMap = lifeStages;
    this.cityMap = city;
    this.childcareMap = childcare;
    this.kidsWelcomeMap = kidsWelcome;

    log(
      `Loaded ${Object.keys(topics).length} topics, ` +
        `${Object.keys(audiences).length} audiences, ` +
        `${Object.keys(lifeStages).length} life stages, ` +
        `${Object.keys(city).length} cities, ` +
        `${Object.keys(childcare).length} childcare, ` +
        `${Object.keys(kidsWelcome).length} kids-welcome options`
    );
  }

  mapValuesToIds(values: string[], map: ReferenceMap): string[] {
    return values.flatMap((value) => {
      const id = map[value];
      if (!id) {
        log(`Warning: No matching Webflow item for value: ${value}`);
        return [];
      }
      return [id];
    });
  }

  async getExistingItems(): Promise<WebflowItem[]> {
    log("Fetching existing items from Webflow...");

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
    log(`Retrieved ${data.items?.length ?? 0} existing Webflow items`);
    return data.items ?? [];
  }

  transformGroupForWebflow(
    group: SyncGroup
  ): { fieldData: Record<string, unknown> } {
    const spotsAvailable = calculateSpotsAvailable(
      group.capacity,
      group.current_members
    );

    const fieldData: Record<string, unknown> = {
      name: group.name,
      slug: group.slug,
    };

    if (group.rock_id != null) fieldData["rock-id"] = group.rock_id;
    if (group.description) fieldData["description-2"] = group.description;
    if (group.campus) fieldData["campus-2"] = group.campus;
    if (group.group_type) fieldData["group-type-2"] = group.group_type;
    if (group.meeting_time) fieldData["meeting-time"] = group.meeting_time;
    if (group.schedule_description)
      fieldData["schedule-description"] = group.schedule_description;
    if (group.capacity != null) fieldData["capacity"] = group.capacity;
    if (group.current_members != null)
      fieldData["current-members"] = group.current_members;
    if (spotsAvailable != null) fieldData["spots-available"] = spotsAvailable;
    if (group.registration_url)
      fieldData["registration-url"] = group.registration_url;
    if (group.is_active != null) fieldData["is-active"] = group.is_active;
    if (group.is_public != null) fieldData["is-public-2"] = group.is_public;

    try {
      if (group.topics.length > 0 && this.topicsMap) {
        const ids = this.mapValuesToIds(group.topics, this.topicsMap);
        if (ids.length > 0) fieldData["group-topics"] = ids;
      }
    } catch (e) {
      log(`Warning: topics mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.audience.length > 0 && this.audiencesMap) {
        const ids = this.mapValuesToIds(group.audience, this.audiencesMap);
        if (ids.length > 0) fieldData["group-audiences"] = ids;
      }
    } catch (e) {
      log(`Warning: audience mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.life_stages.length > 0 && this.lifeStagesMap) {
        const ids = this.mapValuesToIds(group.life_stages, this.lifeStagesMap);
        if (ids.length > 0) fieldData["group-life-stages"] = ids;
      }
    } catch (e) {
      log(`Warning: life_stages mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.city && this.cityMap) {
        const ids = this.mapValuesToIds([group.city], this.cityMap);
        if (ids.length > 0) fieldData["city"] = ids[0];
      }
    } catch (e) {
      log(`Warning: city mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.childcare_provided && this.childcareMap) {
        const ids = this.mapValuesToIds(
          [group.childcare_provided],
          this.childcareMap
        );
        if (ids.length > 0) fieldData["childcare-available"] = ids[0];
      }
    } catch (e) {
      log(`Warning: childcare mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    try {
      if (group.kids_welcome && this.kidsWelcomeMap) {
        const ids = this.mapValuesToIds(
          [group.kids_welcome],
          this.kidsWelcomeMap
        );
        if (ids.length > 0) fieldData["kids-welcome"] = ids[0];
      }
    } catch (e) {
      log(`Warning: kids_welcome mapping failed for ${group.name}: ${(e as Error).message}`);
    }

    return { fieldData };
  }

  async createItems(
    groups: SyncGroup[]
  ): Promise<{ created: number; itemIds: string[] }> {
    if (groups.length === 0) return { created: 0, itemIds: [] };

    log(`Creating ${groups.length} new items in Webflow...`);

    let created = 0;
    const itemIds: string[] = [];

    for (const group of groups) {
      const payload = this.transformGroupForWebflow(group);

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
          `Failed to create item ${group.name}`,
          new Error(errorText)
        );
        continue;
      }

      const data = await response.json();
      itemIds.push(data.id);
      created++;
      log(`Created ${created}/${groups.length}: ${group.name}`);

      if (created < groups.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    log(`Created ${created} items`);
    return { created, itemIds };
  }

  async updateItem(itemId: string, group: SyncGroup): Promise<void> {
    const payload = this.transformGroupForWebflow(group);

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

  // THE FIX: promote drafted items to published state
  async publishItems(itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;

    log(`Publishing ${itemIds.length} items...`);

    const response = await fetch(
      `${this.baseUrl}/collections/${this.collectionId}/items/publish`,
      {
        method: "POST",
        headers: this.authHeaders,
        body: JSON.stringify({ itemIds }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to publish items: ${response.status} - ${errorText}`
      );
    }

    log(`Published ${itemIds.length} items`);
  }

  async publishSite(): Promise<void> {
    log("Publishing Webflow site...");

    const response = await fetch(
      `${this.baseUrl}/sites/${this.siteId}/publish`,
      {
        method: "POST",
        headers: this.authHeaders,
        body: JSON.stringify({}),
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- webflow-client
```

Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/sync/webflow-client.ts lib/__tests__/webflow-client.test.ts
git commit -m "feat: Webflow client with publishing fix and tests"
```

---

## Task 6: Sync Orchestrator

**Files:**
- Create: `lib/sync/index.ts`

The orchestrator runs three stages: Rock→Supabase, Supabase→Webflow (create + update), then publish all affected item IDs.

- [ ] **Step 1: Create `lib/sync/index.ts`**

```typescript
import type { SyncEnv, SyncStats } from "./types";
import { RockRMSClient } from "./rock-client";
import { SupabaseClient } from "./supabase-client";
import { WebflowClient } from "./webflow-client";
import { log, logError } from "./utils";

export async function fullSync(env: SyncEnv): Promise<SyncStats> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  const rock = new RockRMSClient(env.ROCK_API_URL, env.ROCK_REST_KEY);
  const supabase = new SupabaseClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY
  );
  const webflow = new WebflowClient(
    env.WEBFLOW_API_TOKEN,
    env.WEBFLOW_SITE_ID,
    env.WEBFLOW_COLLECTION_ID
  );

  const duration = () => Math.round((Date.now() - startTime) / 1000);

  try {
    // Stage 1: Rock RMS → Supabase
    log("--- Stage 1: Rock RMS → Supabase ---");
    const rockGroups = await rock.fetchGroups();
    await supabase.upsertGroups(rockGroups);
    await supabase.logSync("rock_to_supabase", "success", {
      processed: rockGroups.length,
      startedAt,
      duration: duration(),
    });

    // Stage 2: Supabase → Webflow (create + update)
    log("--- Stage 2: Supabase → Webflow ---");
    await webflow.initializeReferenceMaps();

    const supabaseGroups = await supabase.getAllGroups();
    const existingItems = await webflow.getExistingItems();

    const existingMap = new Map(
      existingItems.map((item) => [item.fieldData["rock-id"] as number, item])
    );

    const toCreate = supabaseGroups.filter((g) => !existingMap.has(g.rock_id));
    const toUpdate = supabaseGroups
      .filter((g) => existingMap.has(g.rock_id))
      .map((g) => ({ item: existingMap.get(g.rock_id)!, group: g }));

    log(`${toCreate.length} to create, ${toUpdate.length} to update`);

    const { created, itemIds: createdIds } = await webflow.createItems(toCreate);

    const updatedIds: string[] = [];
    let updated = 0;
    for (const { item, group } of toUpdate) {
      await webflow.updateItem(item.id, group);
      updatedIds.push(item.id);
      updated++;
      if (updated % 10 === 0) log(`Updated ${updated}/${toUpdate.length}`);
      if (updated < toUpdate.length)
        await new Promise((r) => setTimeout(r, 200));
    }

    // Stage 3: Publish all affected items
    log("--- Stage 3: Publish ---");
    const allAffectedIds = [...createdIds, ...updatedIds];

    try {
      await webflow.publishItems(allAffectedIds);
      await webflow.publishSite();
    } catch (publishError) {
      logError(
        "Publish failed — items written but not yet published",
        publishError as Error
      );
      log("Publish manually via Webflow dashboard or wait for next sync");
    }

    await supabase.logSync("supabase_to_webflow", "success", {
      processed: supabaseGroups.length,
      created,
      updated,
      startedAt,
      duration: duration(),
    });

    log(`=== Full sync completed in ${duration()}s ===`);

    return {
      startedAt,
      rockToSupabase: { processed: rockGroups.length, status: "success" },
      supabaseToWebflow: {
        processed: supabaseGroups.length,
        created,
        updated,
        published: allAffectedIds.length,
        status: "success",
      },
      duration: duration(),
    };
  } catch (error) {
    logError("Full sync failed", error as Error);

    try {
      await supabase.logSync(
        "full_sync",
        "failed",
        { startedAt, duration: duration() },
        error as Error
      );
    } catch (logErr) {
      console.error("Failed to log sync error:", logErr);
    }

    throw error;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/sync/index.ts
git commit -m "feat: fullSync orchestrator"
```

---

## Task 7: API Route Handler (TDD)

**Files:**
- Create: `app/api/sync-groups/route.ts`
- Modify: `vitest.config.ts` (add `@/` alias so route imports resolve in tests)

Vercel Cron sends a GET request to the configured path with `Authorization: Bearer {CRON_SECRET}`. Manual callers use POST with the same header.

- [ ] **Step 1: Add path alias to `vitest.config.ts`**

Replace the entire file content:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve("./"),
    },
  },
});
```

- [ ] **Step 2: Write the failing route tests**

```typescript
// app/api/sync-groups/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";

vi.mock("@/lib/sync", () => ({
  fullSync: vi.fn().mockResolvedValue({
    startedAt: "2026-01-01T00:00:00Z",
    rockToSupabase: { processed: 10, status: "success" },
    supabaseToWebflow: {
      processed: 10,
      created: 2,
      updated: 8,
      published: 10,
      status: "success",
    },
    duration: 5,
  }),
}));

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  process.env.ROCK_API_URL = "https://rock.test/api";
  process.env.ROCK_REST_KEY = "key";
  process.env.SUPABASE_URL = "https://supabase.test";
  process.env.SUPABASE_SERVICE_KEY = "key";
  process.env.WEBFLOW_API_TOKEN = "token";
  process.env.WEBFLOW_SITE_ID = "site-id";
  process.env.WEBFLOW_COLLECTION_ID = "collection-id";
});

describe("GET /api/sync-groups", () => {
  it("returns 401 without Authorization header", async () => {
    const req = new Request("http://localhost/api/sync-groups");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong secret", async () => {
    const req = new Request("http://localhost/api/sync-groups", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and success:true with correct secret", async () => {
    const req = new Request("http://localhost/api/sync-groups", {
      headers: { Authorization: "Bearer test-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("POST /api/sync-groups", () => {
  it("returns 401 without Authorization header", async () => {
    const req = new Request("http://localhost/api/sync-groups", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with correct secret", async () => {
    const req = new Request("http://localhost/api/sync-groups", {
      method: "POST",
      headers: { Authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- route
```

Expected: FAIL with `Cannot find module './route'`

- [ ] **Step 4: Create `app/api/sync-groups/route.ts`**

```typescript
import { fullSync } from "@/lib/sync";
import type { SyncEnv } from "@/lib/sync/types";

function getEnv(): SyncEnv {
  const required = [
    "ROCK_API_URL",
    "ROCK_REST_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "WEBFLOW_API_TOKEN",
    "WEBFLOW_SITE_ID",
    "WEBFLOW_COLLECTION_ID",
    "CRON_SECRET",
  ] as const;

  for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
  }

  return {
    ROCK_API_URL: process.env.ROCK_API_URL!,
    ROCK_REST_KEY: process.env.ROCK_REST_KEY!,
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY!,
    WEBFLOW_API_TOKEN: process.env.WEBFLOW_API_TOKEN!,
    WEBFLOW_SITE_ID: process.env.WEBFLOW_SITE_ID!,
    WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID!,
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
  const stats = await fullSync(env);
  return Response.json({ success: true, stats });
}

// Vercel Cron triggers via GET
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

// Manual trigger via POST
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

- [ ] **Step 5: Run all tests to verify everything passes**

```bash
npm test
```

Expected: All tests PASS (sync-utils, rock-client, webflow-client, route, sunday-hero)

- [ ] **Step 6: Commit**

```bash
git add app/api/sync-groups/route.ts app/api/sync-groups/route.test.ts vitest.config.ts
git commit -m "feat: sync-groups route handler with auth tests"
```

---

## Task 8: Vercel Config and Environment Variables

**Files:**
- Create: `vercel.json`
- Create: `.env.local.example`

- [ ] **Step 1: Create `vercel.json`**

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

The cron fires at 00:00, 06:00, 12:00, 18:00 UTC every day. Vercel automatically includes `Authorization: Bearer {CRON_SECRET}` in the GET request.

- [ ] **Step 2: Create `.env.local.example`**

```bash
# Rock RMS
ROCK_API_URL=https://rms.spiritchurch.co/api
ROCK_REST_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Webflow
WEBFLOW_API_TOKEN=
WEBFLOW_SITE_ID=
WEBFLOW_COLLECTION_ID=

# Cron security — generate with: openssl rand -base64 32
CRON_SECRET=
```

- [ ] **Step 3: Add env vars to Vercel**

For each variable in `.env.local.example`, run:

```bash
vercel env add ROCK_API_URL
vercel env add ROCK_REST_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
vercel env add WEBFLOW_API_TOKEN
vercel env add WEBFLOW_SITE_ID
vercel env add WEBFLOW_COLLECTION_ID
vercel env add CRON_SECRET
```

Select "Production, Preview, Development" for each. Values come from your existing Cloudflare Worker env vars.

- [ ] **Step 4: Pull env vars to local**

```bash
vercel env pull .env.local
```

Verify `.env.local` now has all 8 variables populated.

- [ ] **Step 5: Run a local test sync to verify end-to-end**

```bash
curl -X POST http://localhost:3000/api/sync-groups \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)"
```

Expected response:
```json
{
  "success": true,
  "stats": {
    "rockToSupabase": { "processed": <N>, "status": "success" },
    "supabaseToWebflow": { "created": <N>, "updated": <N>, "published": <N>, "status": "success" },
    "duration": <seconds>
  }
}
```

Check the Webflow CMS dashboard to confirm groups are published (not staged).

- [ ] **Step 6: Commit and push**

```bash
git add vercel.json .env.local.example
git commit -m "feat: Vercel cron config and env var docs"
git push
```

- [ ] **Step 7: Verify cron is registered in Vercel**

After pushing, open the Vercel dashboard → your project → **Cron Jobs** tab. Confirm `/api/sync-groups` appears with a `0 */6 * * *` schedule. Trigger it manually once from the dashboard to confirm it runs successfully in production.

- [ ] **Step 8: Decommission the Cloudflare Worker**

Once the Vercel cron has run successfully at least once, disable or delete the Cloudflare Worker to avoid duplicate syncs running simultaneously.
