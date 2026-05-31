# Group Image Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read `group-image` from the Webflow API response and pass it through to `GroupCard` so real group images appear in the "Join a group" home carousel.

**Architecture:** `AppGroup` in `lib/webflow.ts` is missing `imageSrc`. Adding it to the interface and mapping it from `fieldData["group-image"]` in `getGroups()` is sufficient — `GroupCard` already accepts `imageSrc?` with a placeholder fallback, and `page.tsx` already spreads the full group object onto `GroupCard`.

**Tech Stack:** TypeScript, Next.js App Router, Webflow v2 API

---

## File Map

| File | Change |
| ---- | ------ |
| `lib/webflow.ts` | Add `imageSrc?: string` to `AppGroup`; map `group-image` in `getGroups()` |

---

## Task 1: Add imageSrc to AppGroup and getGroups

**Files:**
- Modify: `lib/webflow.ts`

- [ ] **Step 1: Add `imageSrc` to the `AppGroup` interface**

Find the `AppGroup` interface in `lib/webflow.ts` (currently lines 171–176):

```ts
export interface AppGroup {
  id: string;
  title: string;
  category: string;
  href: string;
}
```

Replace it with:

```ts
export interface AppGroup {
  id: string;
  title: string;
  category: string;
  imageSrc?: string;
  href: string;
}
```

- [ ] **Step 2: Map `group-image` in `getGroups()`**

In the `.map()` inside `getGroups()`, the current return object is:

```ts
.map((item) => ({
  id: item.id,
  title: item.fieldData.name as string,
  category: "Small Group",
  href: (item.fieldData["registration-url"] as string | null) ?? "#",
}));
```

Replace it with:

```ts
.map((item) => ({
  id: item.id,
  title: item.fieldData.name as string,
  category: "Small Group",
  imageSrc: (item.fieldData["group-image"] as WfImage | null)?.url,
  href: (item.fieldData["registration-url"] as string | null) ?? "#",
}));
```

`WfImage` is already defined at line 15 as `{ url: string; alt: string | null }` and used by events and header cards — no import needed.

- [ ] **Step 3: Confirm TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run existing tests to confirm nothing broke**

```bash
npm test
```

Expected: all 66 tests pass (no tests cover `getGroups()` — it makes live API calls).

- [ ] **Step 5: Commit**

```bash
git add lib/webflow.ts
git commit -m "feat: read group-image from Webflow and pass to GroupCard"
```

- [ ] **Step 6: Verify visually in the dev server**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Scroll to the "Join a group" carousel. Groups that have a `group-image` synced from Rock RMS should display their image instead of the placeholder. Groups without an image should still show the placeholder (`/images/placeholder-image.png`).

If images are missing (all groups still show placeholder), check:
1. The sync has run since `group-image` was added — trigger manually if needed:
   ```bash
   curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-groups \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```
2. The Webflow collection has `group-image` populated — check in the Webflow dashboard
3. Log `item.fieldData["group-image"]` inside `getGroups()` to inspect the raw value from the API
