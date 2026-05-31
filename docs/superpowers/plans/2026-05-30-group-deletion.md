# Group Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete Webflow CMS items and Supabase rows when a group is marked archived (`IsArchived=true`) in Rock RMS.

**Architecture:** Rock RMS returns all groups including archived ones. During sync, groups are split into `activeGroups` (is_archived=false) and `toDelete` (is_archived=true). Active groups follow the existing create/update path. Archived groups are deleted from Webflow and Supabase using the `existingMap` already built in Stage 2 — no extra API calls.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, Webflow v2 API, Supabase REST API, Rock RMS REST API

---

## File Map

| File | Change |
| ---- | ------ |
| `lib/sync/types.ts` | Add `IsArchived` to `RockRawGroup`; add `is_archived` to `SyncGroup`; add `deleted` to `SyncStats.supabaseToWebflow` |
| `lib/sync/rock-client.ts` | Map `rockGroup.IsArchived` → `is_archived` in `transformGroup` |
| `lib/sync/webflow-client.ts` | Add `deleteItem(itemId)` and `deleteItems(itemIds[])` |
| `lib/sync/supabase-client.ts` | Add `deleteGroups(rockIds[])` |
| `lib/sync/index.ts` | Split Rock groups; add delete path to `fullSync`; include `deleted` in returned stats |
| `lib/__tests__/rock-client.test.ts` | Add `is_archived` mapping tests |
| `lib/__tests__/webflow-client.test.ts` | Update `baseGroup` fixture; add `deleteItem` and `deleteItems` tests |

---

## Task 1: Add `is_archived` to types and rock-client mapping

**Files:**
- Modify: `lib/sync/types.ts`
- Modify: `lib/sync/rock-client.ts`
- Modify: `lib/__tests__/rock-client.test.ts`
- Modify: `lib/__tests__/webflow-client.test.ts`

- [ ] **Step 1: Write failing tests for IsArchived mapping**

Add these three cases to the `describe("transformGroup")` block in `lib/__tests__/rock-client.test.ts`:

```ts
it("maps IsArchived=true to is_archived=true", () => {
  const raw = {
    Id: 1,
    Name: "Archived Group",
    Description: "",
    GroupTypeId: 25,
    IsActive: false,
    IsPublic: false,
    IsArchived: true,
  };
  expect(client.transformGroup(raw).is_archived).toBe(true);
});

it("maps IsArchived=false to is_archived=false", () => {
  const raw = {
    Id: 1,
    Name: "Active Group",
    Description: "",
    GroupTypeId: 25,
    IsActive: true,
    IsPublic: true,
    IsArchived: false,
  };
  expect(client.transformGroup(raw).is_archived).toBe(false);
});

it("defaults is_archived to false when IsArchived is absent", () => {
  const raw = {
    Id: 1,
    Name: "No Archive Field",
    Description: "",
    GroupTypeId: 25,
    IsActive: true,
    IsPublic: true,
  };
  expect(client.transformGroup(raw).is_archived).toBe(false);
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm test -- --reporter=verbose lib/__tests__/rock-client.test.ts
```

Expected: 3 new tests FAIL with `Property 'is_archived' does not exist` or similar TypeScript error.

- [ ] **Step 3: Add `IsArchived` to `RockRawGroup` and `is_archived` to `SyncGroup` in `lib/sync/types.ts`**

In `RockRawGroup`, add after `IsPublic`:
```ts
IsArchived: boolean;
```

In `SyncGroup`, add after `is_public`:
```ts
is_archived: boolean;
```

- [ ] **Step 4: Map `IsArchived` in `transformGroup` in `lib/sync/rock-client.ts`**

In the `return` block of `transformGroup`, add after `is_public: rockGroup.IsPublic,`:
```ts
is_archived: rockGroup.IsArchived ?? false,
```

- [ ] **Step 5: Update `baseGroup` fixture in `lib/__tests__/webflow-client.test.ts`**

The `baseGroup` object is typed as `SyncGroup` and now requires `is_archived`. Add it after `is_public: true`:
```ts
is_archived: false,
```

- [ ] **Step 6: Run all tests and confirm they pass**

```bash
npm test
```

Expected: all tests pass including the 3 new ones.

- [ ] **Step 7: Commit**

```bash
git add lib/sync/types.ts lib/sync/rock-client.ts lib/__tests__/rock-client.test.ts lib/__tests__/webflow-client.test.ts
git commit -m "feat: add is_archived field to types and rock-client mapping"
```

---

## Task 2: Add `deleteItem` and `deleteItems` to `WebflowClient`

**Files:**
- Modify: `lib/sync/webflow-client.ts`
- Modify: `lib/__tests__/webflow-client.test.ts`

- [ ] **Step 1: Add `vi` and `afterEach` to imports in `lib/__tests__/webflow-client.test.ts`**

Replace the existing import line:
```ts
import { describe, it, expect, beforeEach } from "vitest";
```
With:
```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
```

- [ ] **Step 2: Write failing tests for `deleteItem` and `deleteItems`**

Add these two describe blocks to the end of `lib/__tests__/webflow-client.test.ts`:

```ts
describe("deleteItem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

- [ ] **Step 3: Run tests and confirm they fail**

```bash
npm test -- --reporter=verbose lib/__tests__/webflow-client.test.ts
```

Expected: new tests FAIL with `client.deleteItem is not a function`.

- [ ] **Step 4: Implement `deleteItem` and `deleteItems` in `lib/sync/webflow-client.ts`**

Add these two methods before the closing `}` of the `WebflowClient` class (after `publishSite`):

```ts
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

  log(`Deleting ${itemIds.length} items from Webflow...`);

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

  log(`Deleted ${deleted} items`);
  return deleted;
}
```

- [ ] **Step 5: Run all tests and confirm they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/sync/webflow-client.ts lib/__tests__/webflow-client.test.ts
git commit -m "feat: add deleteItem and deleteItems to WebflowClient"
```

---

## Task 3: Add `deleteGroups` to `SupabaseClient`

**Files:**
- Modify: `lib/sync/supabase-client.ts`

- [ ] **Step 1: Implement `deleteGroups` in `lib/sync/supabase-client.ts`**

Add this method after `getAllGroups` (before `logSync`):

```ts
async deleteGroups(rockIds: number[]): Promise<number> {
  if (rockIds.length === 0) return 0;

  log(`Deleting ${rockIds.length} groups from Supabase...`);

  const idList = rockIds.join(",");
  const response = await fetch(
    `${this.url}/rest/v1/groups?rock_id=in.(${idList})`,
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

  const result: SyncGroup[] = await response.json();
  log(`Deleted ${result.length} groups from Supabase`);
  return result.length;
}
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/sync/supabase-client.ts
git commit -m "feat: add deleteGroups to SupabaseClient"
```

---

## Task 4: Wire delete path into `fullSync` orchestrator

**Files:**
- Modify: `lib/sync/index.ts`
- Modify: `lib/sync/types.ts`

- [ ] **Step 1: Add `deleted` to `SyncStats` in `lib/sync/types.ts`**

In the `supabaseToWebflow` block of `SyncStats`, add `deleted: number` after `updated: number`:

```ts
export interface SyncStats {
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

- [ ] **Step 2: Replace the `fullSync` body in `lib/sync/index.ts`**

Replace the contents of the `try` block in `fullSync` with the following (everything from `// Stage 1` through the `return` statement):

```ts
    // Stage 1: Rock RMS → Supabase
    log("--- Stage 1: Rock RMS → Supabase ---");
    const rockGroups = await rock.fetchGroups();

    const toDelete = rockGroups.filter((g) => g.is_archived);
    const activeGroups = rockGroups.filter((g) => !g.is_archived);
    log(
      `${activeGroups.length} active groups, ${toDelete.length} archived groups to delete`
    );

    await supabase.upsertGroups(activeGroups);
    if (toDelete.length > 0) {
      await supabase.deleteGroups(toDelete.map((g) => g.rock_id));
    }
    await supabase.logSync("rock_to_supabase", "success", {
      processed: activeGroups.length,
      startedAt,
      duration: duration(),
    });

    // Stage 2: Supabase → Webflow (create + update + delete)
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
      try {
        await webflow.updateItem(item.id, group);
        updatedIds.push(item.id);
        updated++;
        if (updated % 10 === 0) log(`Updated ${updated}/${toUpdate.length}`);
      } catch (updateError) {
        logError(
          `Failed to update item ${item.id} (${group.name})`,
          updateError as Error
        );
      }
      if (updated < toUpdate.length)
        await new Promise((r) => setTimeout(r, 200));
    }

    // Delete archived groups from Webflow
    const toDeleteWebflowIds = toDelete
      .map((g) => existingMap.get(g.rock_id)?.id)
      .filter((id): id is string => id !== undefined);
    const deleted = await webflow.deleteItems(toDeleteWebflowIds);

    // Stage 3: Publish all created/updated items
    log("--- Stage 3: Publish ---");
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
      rockToSupabase: { processed: activeGroups.length, status: "success" },
      supabaseToWebflow: {
        processed: supabaseGroups.length,
        created,
        updated,
        deleted,
        published,
        status: "success",
      },
      duration: duration(),
    };
```

- [ ] **Step 3: Run all tests and confirm they pass**

```bash
npm test
```

Expected: all tests pass. TypeScript should compile without errors.

- [ ] **Step 4: Commit**

```bash
git add lib/sync/index.ts lib/sync/types.ts
git commit -m "feat: add delete path for archived groups in fullSync"
```

---

## Task 5: Verify `publishSite` behavior after deletions

**Context:** The spec flagged this as uncertain. When a Webflow CMS item is deleted via the API, it may or may not be removed from the live published site without a `publishSite` call. The current implementation does NOT call `publishSite` after deletions (only after creates/updates).

- [ ] **Step 1: Trigger a manual sync with a test archived group**

In Rock RMS, archive a test group (or note the rock_id of any already-archived group that has a Webflow item). Trigger the sync manually:

```bash
curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-groups \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Check the response — confirm `deleted` count is > 0.

- [ ] **Step 2: Check the Webflow CMS and live site**

In the Webflow dashboard, confirm the archived group's CMS item no longer exists. Check the live site to confirm the group is gone.

- [ ] **Step 3: If the item persists on the live site, add `publishSite` after deletions**

If Step 2 shows the item was removed from the CMS but still appears on the live site, add a `publishSite` call after `deleteItems` in `lib/sync/index.ts`. Place it inside a try/catch matching the existing publish block:

```ts
// After: const deleted = await webflow.deleteItems(toDeleteWebflowIds);
if (deleted > 0) {
  try {
    await webflow.publishSite();
  } catch (publishError) {
    logError("publishSite after deletions failed", publishError as Error);
  }
}
```

Then commit:
```bash
git add lib/sync/index.ts
git commit -m "fix: publishSite after Webflow item deletions"
```

- [ ] **Step 4: If no change needed, note the confirmed behavior in the dev doc**

Add a line to the **Current Status** section of `docs/Development/groups-sync.md`:
```
- **Webflow delete behavior verified:** Deleting a CMS item via API removes it from the live site without a publishSite call.
```

Then commit:
```bash
git add docs/Development/groups-sync.md
git commit -m "docs: confirm Webflow delete behavior after live verification"
```
