# Group Image Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the `group-image` Webflow CMS field with the Rock RMS image URL during every sync run.

**Architecture:** `group_image` (a URL string or null) is already fetched from Rock and stored on `SyncGroup`. The only missing piece is sending it to Webflow. Add one conditional to `transformGroupForWebflow` in `lib/sync/webflow-client.ts` — if `group_image` is non-null, include it in `fieldData["group-image"]`. Webflow accepts a plain URL string for Image fields and handles fetch/cache server-side.

**Tech Stack:** TypeScript, Vitest, Webflow v2 API

---

## File Map

| File | Change |
| ---- | ------ |
| `lib/sync/webflow-client.ts` | Add `group-image` to `transformGroupForWebflow` |
| `lib/__tests__/webflow-client.test.ts` | Add 2 tests: image present, image null |
| `docs/Development/groups-sync.md` | Add `group-image` row to Webflow field table |

---

## Task 1: Add group-image to transformGroupForWebflow

**Files:**
- Modify: `lib/sync/webflow-client.ts`
- Modify: `lib/__tests__/webflow-client.test.ts`
- Modify: `docs/Development/groups-sync.md`

- [ ] **Step 1: Write the two failing tests**

In `lib/__tests__/webflow-client.test.ts`, add these two cases inside the existing `describe("transformGroupForWebflow")` block (after the last `it(...)` in that block):

```ts
it("includes group-image URL when group_image is set", () => {
  const group: SyncGroup = {
    ...baseGroup,
    group_image: "https://rms.spiritchurch.co/GetImage.ashx?guid=abc123",
  };
  const { fieldData } = client.transformGroupForWebflow(group);
  expect(fieldData["group-image"]).toBe(
    "https://rms.spiritchurch.co/GetImage.ashx?guid=abc123"
  );
});

it("omits group-image when group_image is null", () => {
  // baseGroup.group_image is already null
  const { fieldData } = client.transformGroupForWebflow(baseGroup);
  expect(fieldData).not.toHaveProperty("group-image");
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npm test -- --reporter=verbose lib/__tests__/webflow-client.test.ts
```

Expected: the two new tests FAIL — `group-image` is not in `fieldData` because it hasn't been added yet.

- [ ] **Step 3: Add the image field to `transformGroupForWebflow`**

In `lib/sync/webflow-client.ts`, find the block that sets `is-public-2`:

```ts
if (group.is_public != null) fieldData["is-public-2"] = group.is_public;
```

Add one line immediately after it:

```ts
if (group.group_image) fieldData["group-image"] = group.group_image;
```

- [ ] **Step 4: Run all tests and confirm they pass**

```bash
npm test
```

Expected: all 66 tests pass (64 existing + 2 new).

- [ ] **Step 5: Update `docs/Development/groups-sync.md`**

In the **Webflow Collection** field table, add a new row after `kids-welcome`:

```markdown
| `group-image` | Image | `group.group_image` (URL string) |
```

Also add `group-image` to the "Fields NOT in schema" note line — actually, remove it from there if it was previously listed. It was not listed there, so no change needed to that line.

- [ ] **Step 6: Commit**

```bash
git add lib/sync/webflow-client.ts lib/__tests__/webflow-client.test.ts docs/Development/groups-sync.md
git commit -m "feat: sync group-image URL to Webflow CMS field"
```
