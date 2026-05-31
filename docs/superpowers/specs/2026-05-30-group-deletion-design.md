# Design: Delete Archived Groups from Webflow

**Date:** 2026-05-30  
**Status:** Approved  
**Workstream:** Groups Sync

---

## Problem

When a group is archived in Rock RMS (`IsArchived=true`), it remains in Webflow indefinitely. The sync pipeline only creates and updates items — it has no delete path. Archived groups accumulate as stale CMS items visible on the site.

---

## Goal

When a group is marked as archived in Rock RMS, automatically delete it from Webflow CMS and from Supabase during the next sync run.

---

## Delete Condition

```
is_archived === true
```

`is_active` status is irrelevant — archiving alone is sufficient to trigger deletion.

---

## Architecture

The sync pipeline gains a delete path alongside the existing create/update path.

```
Rock RMS (all groups)
    ↓
Split by is_archived
    ├── is_archived=false → activeGroups → upsert Supabase → create/update Webflow → publish
    └── is_archived=true  → toDelete     → delete from Supabase + delete from Webflow
```

The existing `getExistingItems()` call (already made in Stage 2) returns all Webflow items keyed by `rock-id`. The delete path reuses this map to resolve Webflow item IDs for archived groups without an extra API call.

---

## Data Model Changes

### `lib/sync/types.ts`

**`RockRawGroup`** — add:
```ts
IsArchived: boolean;
```

**`SyncGroup`** — add:
```ts
is_archived: boolean;
```

**`SyncStats.supabaseToWebflow`** — add:
```ts
deleted: number;
```

---

## Component Changes

### `lib/sync/rock-client.ts`

`transformGroup` maps `rockGroup.IsArchived` → `is_archived`. No other changes.

### `lib/sync/supabase-client.ts`

Add `deleteGroups(rockIds: number[]): Promise<number>`:
- `DELETE /rest/v1/groups?rock_id=in.(...)` 
- Returns count of deleted rows

### `lib/sync/webflow-client.ts`

Add `deleteItem(itemId: string): Promise<void>`:
- `DELETE /v2/collections/{collectionId}/items/{itemId}`
- Throws on non-2xx

Add `deleteItems(itemIds: string[]): Promise<number>`:
- Loops over IDs, calls `deleteItem` per item with per-item error handling (log error, continue)
- 200ms delay between calls (matches existing create/update rate limiting)
- Returns count of successfully deleted items

### `lib/sync/index.ts`

In `fullSync`, after fetching Rock groups:

```ts
const toDelete = rockGroups.filter(g => g.is_archived);
const activeGroups = rockGroups.filter(g => !g.is_archived);
```

**Stage 1** — upsert only `activeGroups` to Supabase; then delete `toDelete` by rock_id from Supabase.

**Stage 2** — unchanged: sync `activeGroups` from Supabase → Webflow (create + update). The `existingMap` built here is also used by Stage 2b.

**Stage 2b** — resolve Webflow item IDs for `toDelete` groups using `existingMap`; call `webflow.deleteItems(...)`. Groups in `toDelete` that have no matching Webflow item are skipped silently (they were never synced).

**Stage 3 (Publish)** — unchanged: publish only created/updated items. Deleted items do not need publishing.

Return `deleted` count in `SyncStats`.

---

## Error Handling

- Per-item delete errors are logged and skipped — a single bad delete does not abort the sync
- If Supabase delete fails, it is logged but does not block the Webflow delete (and vice versa)
- Deleted items are not included in the publish step

---

## Testing

| File | What to add |
| ---- | ----------- |
| `lib/__tests__/rock-client.test.ts` | `IsArchived: true` maps to `is_archived: true`; `IsArchived: false` maps to `is_archived: false` |
| `lib/__tests__/webflow-client.test.ts` | `deleteItem` happy path; `deleteItem` throws on 404; `deleteItems` skips failed items and returns correct count |
| `lib/__tests__/sync-route.test.ts` | Stats shape includes `deleted` field |

---

## Out of Scope

- Soft-delete / audit trail in Supabase
- Pagination for `getExistingItems` (pre-existing limitation, tracked separately)

## Verify During Implementation

- Whether a `publishSite` call is needed after deletions. Webflow may remove published items from the live site automatically on DELETE, or it may require a site republish. If a republish is needed, call `publishSite` at the end of the delete path (after `deleteItems`).
