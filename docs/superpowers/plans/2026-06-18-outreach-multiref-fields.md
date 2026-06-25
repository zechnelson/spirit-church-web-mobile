# Outreach Sync — Multi-Reference CMS Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4 PlainText filter fields (`campus`, `event`, `category`, `city`) on the Webflow `outreach-projects` collection with MultiRef fields backed by new reference collections, enabling proper Webflow CMS filtering on the public outreach page.

**Architecture:** Four new Webflow CMS collections are created (outreach-campuses, outreach-events, outreach-categories, outreach-cities). Each sync run auto-upserts missing values into those reference collections from the live Rock RMS data, then writes MultiRef ID arrays (instead of plain strings) to the outreach-projects items. Collection IDs are hardcoded in the client class, matching the Groups Sync pattern.

**Tech Stack:** TypeScript, Vitest, Webflow CMS API v2, Webflow MCP

## Global Constraints

- Webflow site ID: `68ae1c452c9ac726c7a745ee`
- `outreach-projects` collection ID: `6a28cbac65cb0f0593f53802`
- No new env vars — collection IDs are hardcoded in the class (matches Groups Sync pattern)
- All tests run with: `npx vitest run`
- Deploy with: `vercel build --prod && vercel deploy --prebuilt --prod`
- Trigger manual sync: `curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-outreach -H "Authorization: Bearer <CRON_SECRET>"`

---

## Task 1: Webflow CMS — Create reference collections and update field schema

**Files:** No code files — Webflow Designer / MCP only

**Produces:** 4 new collection IDs to hardcode in Task 2

This task has no code and no tests. It is a one-time schema change in Webflow. Do it manually in the Webflow Designer or via the Webflow MCP.

### Step 1A: Create the 4 reference collections

In the Webflow Designer (or via Webflow MCP `data_cms_tool`), create these 4 new collections on site `68ae1c452c9ac726c7a745ee`. Each collection needs only a `name` (PlainText) field — the `slug` field is auto-created by Webflow.

| Collection name (display) | Suggested slug |
|--------------------------|----------------|
| Outreach Campuses | `outreach-campuses` |
| Outreach Events | `outreach-events` |
| Outreach Categories | `outreach-categories` |
| Outreach Cities | `outreach-cities` |

- [ ] Create `Outreach Campuses` collection — record its ID as `CAMPUSES_COLLECTION_ID`
- [ ] Create `Outreach Events` collection — record its ID as `EVENTS_COLLECTION_ID`
- [ ] Create `Outreach Categories` collection — record its ID as `CATEGORIES_COLLECTION_ID`
- [ ] Create `Outreach Cities` collection — record its ID as `CITIES_COLLECTION_ID`

### Step 1B: Update the `outreach-projects` field schema

In the Webflow Designer, open the `outreach-projects` collection (`6a28cbac65cb0f0593f53802`) and:

- [ ] Delete the `campus` PlainText field
- [ ] Delete the `event` PlainText field
- [ ] Delete the `category` PlainText field
- [ ] Delete the `city` PlainText field

> **Note:** Deleting these fields will clear the values on the 2 existing items. That is expected — the sync will repopulate them as MultiRef references on next run.

- [ ] Add a MultiRef field named `Campus`, referencing the `Outreach Campuses` collection. Confirm its field slug is `campus`.
- [ ] Add a MultiRef field named `Event`, referencing the `Outreach Events` collection. Confirm its field slug is `event`.
- [ ] Add a MultiRef field named `Category`, referencing the `Outreach Categories` collection. Confirm its field slug is `category`.
- [ ] Add a MultiRef field named `City`, referencing the `Outreach Cities` collection. Confirm its field slug is `city`.

- [ ] **Commit this task's notes** (record the 4 collection IDs somewhere accessible for Task 2)

---

## Task 2: Add reference collection support to `OutreachWebflowClient`

**Files:**
- Modify: `lib/sync/outreach/webflow-client.ts`
- Modify: `lib/__tests__/outreach-webflow-client.test.ts`

**Interfaces:**
- Produces: `OutreachWebflowClient` with public fields `campusMap`, `eventMap`, `categoryMap`, `cityMap` (injectable by tests); methods `fetchReferenceCollection`, `mapValuesToIds`, `upsertReferenceItem`, `syncReferenceCollection`, `initializeReferenceMaps`
- Consumed by: Task 3 (`index.ts` calls `webflow.initializeReferenceMaps(projects)`)

### Step 2.1: Write failing tests for the new reference infrastructure

Replace lines 79–110 in `lib/__tests__/outreach-webflow-client.test.ts` (the 4 plain-text transform tests and their null-omit variants) with tests for the new reference behavior. Also add tests for the new methods. Add this block after the existing `describe("transformProjectForWebflow", ...)` block:

```typescript
// In lib/__tests__/outreach-webflow-client.test.ts

// Replace these 6 tests (lines 79–110):
//   "maps campus as plain text string"
//   "maps event as plain text string"
//   "maps category as plain text string"
//   "maps city as plain text string"
//   "omits campus when null"
//   "omits city when null"
// with:

it("maps campus as MultiRef id array when campusMap is set", () => {
  client.campusMap = { "Chandler Campus": "campus-id-1" };
  const { fieldData } = client.transformProjectForWebflow(baseProject);
  expect(fieldData["campus"]).toEqual(["campus-id-1"]);
});

it("maps event as MultiRef id array when eventMap is set", () => {
  client.eventMap = { "Serve Day": "event-id-1" };
  const { fieldData } = client.transformProjectForWebflow(baseProject);
  expect(fieldData["event"]).toEqual(["event-id-1"]);
});

it("maps category as MultiRef id array when categoryMap is set", () => {
  client.categoryMap = { "Food Prep & Distribution": "category-id-1" };
  const { fieldData } = client.transformProjectForWebflow(baseProject);
  expect(fieldData["category"]).toEqual(["category-id-1"]);
});

it("maps city as MultiRef id array when cityMap is set", () => {
  client.cityMap = { "Tempe": "city-id-1" };
  const { fieldData } = client.transformProjectForWebflow(baseProject);
  expect(fieldData["city"]).toEqual(["city-id-1"]);
});

it("omits campus from fieldData when campusMap is null", () => {
  client.campusMap = null;
  const { fieldData } = client.transformProjectForWebflow(baseProject);
  expect(fieldData).not.toHaveProperty("campus");
});

it("omits campus from fieldData when project.campus is null", () => {
  client.campusMap = { "Chandler Campus": "campus-id-1" };
  const project = { ...baseProject, campus: null };
  const { fieldData } = client.transformProjectForWebflow(project);
  expect(fieldData).not.toHaveProperty("campus");
});

it("omits campus from fieldData when value has no map entry", () => {
  client.campusMap = {};
  const { fieldData } = client.transformProjectForWebflow(baseProject);
  expect(fieldData).not.toHaveProperty("campus");
});

it("omits city from fieldData when cityMap is null", () => {
  client.cityMap = null;
  const { fieldData } = client.transformProjectForWebflow(baseProject);
  expect(fieldData).not.toHaveProperty("city");
});

describe("mapValuesToIds", () => {
  it("returns ids for known values", () => {
    const map = { Gilbert: "id-1", Chandler: "id-2" };
    expect(client.mapValuesToIds(["Gilbert", "Chandler"], map)).toEqual(["id-1", "id-2"]);
  });

  it("skips unknown values without throwing", () => {
    const map = { Gilbert: "id-1" };
    expect(client.mapValuesToIds(["Gilbert", "Unknown"], map)).toEqual(["id-1"]);
  });

  it("returns empty array for empty input", () => {
    expect(client.mapValuesToIds([], {})).toEqual([]);
  });
});

describe("fetchReferenceCollection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds name→id map from collection items", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: "id-1", fieldData: { name: "Gilbert" } },
          { id: "id-2", fieldData: { name: "Chandler" } },
        ],
      }),
    }));

    const map = await client.fetchReferenceCollection("col-id");
    expect(map).toEqual({ Gilbert: "id-1", Chandler: "id-2" });
  });

  it("throws when response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }));

    await expect(client.fetchReferenceCollection("col-id")).rejects.toThrow("401");
  });
});

describe("upsertReferenceItem", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs to the collection and returns the new item id", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "new-id-1" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const id = await client.upsertReferenceItem("col-id", "Gilbert");
    expect(id).toBe("new-id-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.webflow.com/v2/collections/col-id/items",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"name":"Gilbert"'),
      })
    );
  });

  it("throws when POST fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    }));

    await expect(client.upsertReferenceItem("col-id", "Gilbert")).rejects.toThrow("400");
  });
});

describe("syncReferenceCollection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns existing map when all values already exist", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: "id-1", fieldData: { name: "Gilbert" } }],
      }),
    }));

    const map = await client.syncReferenceCollection("col-id", new Set(["Gilbert"]));
    expect(map).toEqual({ Gilbert: "id-1" });
  });

  it("upserts missing values and adds them to the map", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: "id-1", fieldData: { name: "Gilbert" } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "id-2" }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const map = await client.syncReferenceCollection("col-id", new Set(["Gilbert", "Chandler"]));
    expect(map).toEqual({ Gilbert: "id-1", Chandler: "id-2" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("skips a value gracefully when upsert fails", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Server Error",
      });
    vi.stubGlobal("fetch", mockFetch);

    const map = await client.syncReferenceCollection("col-id", new Set(["Gilbert"]));
    expect(map).toEqual({});
  });
});

describe("initializeReferenceMaps", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("populates all 4 maps from project data", async () => {
    const projects: OutreachProject[] = [
      { ...baseProject, campus: "Chandler Campus", event: "Serve Day", category: "Food Prep & Distribution", city: "Tempe" },
    ];

    // 4 fetchReferenceCollection calls return empty → then 4 upsertReferenceItem calls
    const mockFetch = vi.fn()
      // fetch campuses collection
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // upsert "Chandler Campus"
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "campus-1" }) })
      // fetch events collection
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // upsert "Serve Day"
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "event-1" }) })
      // fetch categories collection
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // upsert "Food Prep & Distribution"
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "cat-1" }) })
      // fetch cities collection
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
      // upsert "Tempe"
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "city-1" }) });

    vi.stubGlobal("fetch", mockFetch);

    await client.initializeReferenceMaps(projects);

    expect(client.campusMap).toEqual({ "Chandler Campus": "campus-1" });
    expect(client.eventMap).toEqual({ "Serve Day": "event-1" });
    expect(client.categoryMap).toEqual({ "Food Prep & Distribution": "cat-1" });
    expect(client.cityMap).toEqual({ "Tempe": "city-1" });
  });

  it("ignores null values when collecting unique values", async () => {
    const projects: OutreachProject[] = [
      { ...baseProject, campus: null, event: null, category: null, city: null },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.initializeReferenceMaps(projects);

    // 4 fetchReferenceCollection calls, 0 upserts
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(client.campusMap).toEqual({});
    expect(client.eventMap).toEqual({});
    expect(client.categoryMap).toEqual({});
    expect(client.cityMap).toEqual({});
  });
});
```

- [ ] **Step 2.2: Run the tests to confirm they fail**

```bash
npx vitest run lib/__tests__/outreach-webflow-client.test.ts
```

Expected: new tests fail, existing tests still pass (or some fail due to changed PlainText assertions — that's expected).

- [ ] **Step 2.3: Update `lib/sync/outreach/webflow-client.ts`**

Replace the entire file with:

```typescript
import type { OutreachProject, WebflowOutreachItem } from "./types";
import { log, logError } from "../utils";

type ReferenceMap = Record<string, string>;

export class OutreachWebflowClient {
  private apiToken: string;
  private siteId: string;
  private collectionId: string;
  private baseUrl = "https://api.webflow.com/v2";

  // Fill in IDs from Task 1
  private readonly campusesCollectionId = "REPLACE_WITH_CAMPUSES_COLLECTION_ID";
  private readonly eventsCollectionId = "REPLACE_WITH_EVENTS_COLLECTION_ID";
  private readonly categoriesCollectionId = "REPLACE_WITH_CATEGORIES_COLLECTION_ID";
  private readonly citiesCollectionId = "REPLACE_WITH_CITIES_COLLECTION_ID";

  // Public so tests can inject maps directly without hitting the API
  campusMap: ReferenceMap | null = null;
  eventMap: ReferenceMap | null = null;
  categoryMap: ReferenceMap | null = null;
  cityMap: ReferenceMap | null = null;

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

  async upsertReferenceItem(collectionId: string, name: string): Promise<string> {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const response = await fetch(
      `${this.baseUrl}/collections/${collectionId}/items`,
      {
        method: "POST",
        headers: this.authHeaders,
        body: JSON.stringify({ fieldData: { name, slug } }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create reference item "${name}" in collection ${collectionId}: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    if (!data.id) {
      throw new Error(`Created reference item "${name}" but no id in response`);
    }
    return data.id;
  }

  async syncReferenceCollection(
    collectionId: string,
    values: Set<string>
  ): Promise<ReferenceMap> {
    const map = await this.fetchReferenceCollection(collectionId);

    for (const value of values) {
      if (!map[value]) {
        try {
          const id = await this.upsertReferenceItem(collectionId, value);
          map[value] = id;
          log(`Created reference item "${value}" in collection ${collectionId}`);
        } catch (e) {
          log(`Warning: Failed to create reference item "${value}": ${(e as Error).message}`);
        }
      }
    }

    return map;
  }

  async initializeReferenceMaps(projects: OutreachProject[]): Promise<void> {
    log("Initializing outreach reference collection mappings...");

    const campuses = new Set(projects.map((p) => p.campus).filter((v): v is string => v !== null));
    const events = new Set(projects.map((p) => p.event).filter((v): v is string => v !== null));
    const categories = new Set(projects.map((p) => p.category).filter((v): v is string => v !== null));
    const cities = new Set(projects.map((p) => p.city).filter((v): v is string => v !== null));

    const [campusMap, eventMap, categoryMap, cityMap] = await Promise.all([
      this.syncReferenceCollection(this.campusesCollectionId, campuses),
      this.syncReferenceCollection(this.eventsCollectionId, events),
      this.syncReferenceCollection(this.categoriesCollectionId, categories),
      this.syncReferenceCollection(this.citiesCollectionId, cities),
    ]);

    this.campusMap = campusMap;
    this.eventMap = eventMap;
    this.categoryMap = categoryMap;
    this.cityMap = cityMap;

    log(
      `Loaded ${Object.keys(campusMap).length} campuses, ` +
        `${Object.keys(eventMap).length} events, ` +
        `${Object.keys(categoryMap).length} categories, ` +
        `${Object.keys(cityMap).length} cities`
    );
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
      if (project.campus && this.campusMap) {
        const ids = this.mapValuesToIds([project.campus], this.campusMap);
        if (ids.length > 0) fieldData["campus"] = ids;
      }
    } catch (e) {
      log(`Warning: campus mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      if (project.event && this.eventMap) {
        const ids = this.mapValuesToIds([project.event], this.eventMap);
        if (ids.length > 0) fieldData["event"] = ids;
      }
    } catch (e) {
      log(`Warning: event mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      if (project.category && this.categoryMap) {
        const ids = this.mapValuesToIds([project.category], this.categoryMap);
        if (ids.length > 0) fieldData["category"] = ids;
      }
    } catch (e) {
      log(`Warning: category mapping failed for ${project.name}: ${(e as Error).message}`);
    }

    try {
      if (project.city && this.cityMap) {
        const ids = this.mapValuesToIds([project.city], this.cityMap);
        if (ids.length > 0) fieldData["city"] = ids;
      }
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

> **Important:** Replace the 4 `REPLACE_WITH_*_COLLECTION_ID` placeholders with the actual IDs recorded in Task 1 before proceeding.

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
npx vitest run lib/__tests__/outreach-webflow-client.test.ts
```

Expected: all tests pass

- [ ] **Step 2.5: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 2.6: Commit**

```bash
git add lib/sync/outreach/webflow-client.ts lib/__tests__/outreach-webflow-client.test.ts
git commit -m "feat(outreach-sync): replace PlainText campus/event/category/city with MultiRef fields"
```

---

## Task 3: Wire `initializeReferenceMaps` into the orchestrator

**Files:**
- Modify: `lib/sync/outreach/index.ts`

**Interfaces:**
- Consumes: `OutreachWebflowClient.initializeReferenceMaps(projects: OutreachProject[])` from Task 2
- No interface changes — `fullOutreachSync(env)` signature unchanged

No new tests needed for the orchestrator — the orchestrator test (`outreach-sync-route.test.ts`) mocks the Webflow client entirely, so `initializeReferenceMaps` needs to be added to the mock there if it's called.

- [ ] **Step 3.1: Check if the orchestrator test mocks the webflow client**

Open `lib/__tests__/outreach-sync-route.test.ts` and look for how `OutreachWebflowClient` is mocked. If `initializeReferenceMaps` needs to be on the mock, add `initializeReferenceMaps: vi.fn().mockResolvedValue(undefined)` to the mock object.

Run:
```bash
npx vitest run lib/__tests__/outreach-sync-route.test.ts
```

Note: if this fails with "initializeReferenceMaps is not a function", add it to the mock.

- [ ] **Step 3.2: Add `initializeReferenceMaps` call to `lib/sync/outreach/index.ts`**

In `index.ts`, insert one line after `supabaseProjects` is fetched (around line 53), before `getExistingItems()`:

```typescript
// Stage 2: Supabase → Webflow (create + update + delete)
log("--- Outreach Stage 2: Supabase → Webflow ---");
const supabaseProjects = await supabase.getAllProjects();

// Auto-upsert any new campus/event/category/city values into reference collections
await webflow.initializeReferenceMaps(supabaseProjects);  // ADD THIS LINE

const existingItems = await webflow.getExistingItems();
```

- [ ] **Step 3.3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3.4: Commit**

```bash
git add lib/sync/outreach/index.ts lib/__tests__/outreach-sync-route.test.ts
git commit -m "feat(outreach-sync): call initializeReferenceMaps before Webflow stage"
```

---

## Task 4: Deploy and verify

**Files:** None (deployment only)

- [ ] **Step 4.1: Build and deploy to production**

```bash
vercel build --prod && vercel deploy --prebuilt --prod
```

- [ ] **Step 4.2: Trigger a manual sync**

```bash
curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-outreach \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected response shape:
```json
{
  "success": true,
  "stats": {
    "rockToSupabase": { "processed": 2, "status": "success" },
    "supabaseToWebflow": { "created": 0, "updated": 2, "deleted": 0, "published": 2, "status": "success" },
    "duration": 6000
  }
}
```

- [ ] **Step 4.3: Verify reference collections in Webflow**

In the Webflow Designer, open the 4 reference collections and confirm:
- Items have been created for each unique campus/event/category/city value from the sync
- Each item has a `name` field and an auto-generated `slug`

- [ ] **Step 4.4: Verify outreach-projects items in Webflow**

Open the `outreach-projects` collection and inspect the 2 existing items:
- `campus` field should now show a reference to the matching campus item (not a plain string)
- `event`, `category`, `city` should likewise show references

- [ ] **Step 4.5: Update development doc and commit docs**

Update `docs/Development/outreach-sync.md`:
- Add the 4 new reference collection IDs to the **Webflow Collections** table
- Update the **Webflow field schema** table — change `campus`, `event`, `category`, `city` from `PlainText` to `MultiRef`
- Add a **Session 05** entry

```bash
git add docs/Development/outreach-sync.md
git commit -m "docs: update outreach-sync with MultiRef field schema and new reference collections"
```
