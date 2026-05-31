# Group Card Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign GroupCard to match EventCard's top-image + stacked-text layout, showing group name, neighborhood location, and meeting schedule.

**Architecture:** Three coordinated changes: (1) sync writes a new `location` PlainText field to Webflow so the app can read the city name as a string; (2) `AppGroup` / `getGroups()` maps the two new fields; (3) `GroupCard` is rewritten to the EventCard layout. `page.tsx` is unchanged — it already spreads `{...group}`.

**Tech Stack:** Next.js App Router, Webflow CMS v2 API, Vitest

---

## Prerequisites (manual — do before deploying)

Add a `location` PlainText field to the Webflow Groups collection (`694eff6ac57ffe6994797761`) via the Webflow CMS UI. The field slug must be exactly `location`. This field will hold the neighborhood name as plain text (e.g., "North Phoenix"), mirroring the `city` Ref field which only returns an item ID from the API.

---

## File Map

| File | Change |
|------|--------|
| `lib/sync/webflow-client.ts` | Add `location` write in `transformGroupForWebflow` |
| `lib/__tests__/webflow-client.test.ts` | Add 2 tests for `location` field |
| `lib/webflow.ts` | Update `AppGroup` interface; update `getGroups()` mapping |
| `components/home/GroupCard.tsx` | Full layout rewrite |
| `docs/Development/groups-sync.md` | Add `location` row to field schema table |
| `docs/Development/church-links.md` | Add session entry |

---

## Task 1: Sync — Write `location` field to Webflow

**Files:**
- Modify: `lib/sync/webflow-client.ts` (around line 151, after `group-image-3`)
- Modify: `lib/__tests__/webflow-client.test.ts`

- [ ] **Step 1: Write two failing tests**

Open `lib/__tests__/webflow-client.test.ts`. Add these two tests inside the `describe("transformGroupForWebflow", ...)` block (after the `group-image-3` tests at ~line 108):

```ts
it("writes city name to location PlainText field", () => {
  const { fieldData } = client.transformGroupForWebflow(baseGroup);
  expect(fieldData["location"]).toBe("Phoenix");
});

it("omits location field when city is null", () => {
  const group: SyncGroup = { ...baseGroup, city: null };
  const { fieldData } = client.transformGroupForWebflow(group);
  expect(fieldData).not.toHaveProperty("location");
});
```

Note: `baseGroup.city` is already `"Phoenix"` in the existing fixture.

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose lib/__tests__/webflow-client.test.ts
```

Expected: 2 failures — `"location"` is `undefined`.

- [ ] **Step 3: Add `location` write to `transformGroupForWebflow`**

Open `lib/sync/webflow-client.ts`. Find line 151 (`if (group.group_image) fieldData["group-image-3"] = group.group_image;`). Add the new line directly after it:

```ts
if (group.group_image) fieldData["group-image-3"] = group.group_image;
if (group.city) fieldData["location"] = group.city;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose lib/__tests__/webflow-client.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/sync/webflow-client.ts lib/__tests__/webflow-client.test.ts
git commit -m "feat: sync city name to Webflow location PlainText field"
```

---

## Task 2: App — Update `AppGroup` interface and `getGroups()` mapping

**Files:**
- Modify: `lib/webflow.ts` (interface at ~line 171, mapping at ~line 191)

- [ ] **Step 1: Update `AppGroup` interface**

Open `lib/webflow.ts`. Find the `AppGroup` interface (~line 171). Replace it:

```ts
export interface AppGroup {
  id: string;
  title: string;
  location?: string;
  schedule?: string;
  imageSrc?: string;
  href: string;
}
```

Changes: removed `category: string`, added `location?: string` and `schedule?: string`.

- [ ] **Step 2: Update `getGroups()` mapping**

Find the `.map()` call inside `getGroups()` (~line 191). Replace the object literal:

```ts
.map((item) => ({
  id: item.id,
  title: item.fieldData.name as string,
  location: (item.fieldData["location"] as string | null) ?? undefined,
  schedule: (item.fieldData["schedule-description"] as string | null) ?? undefined,
  imageSrc: (item.fieldData["group-image-3"] as string | null) ?? undefined,
  href: `https://www.spiritchurch.co/groups/${item.fieldData.slug as string}`,
}));
```

Changes: removed `category: "Small Group"`, added `location` and `schedule` reads.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/webflow.ts
git commit -m "feat: add location and schedule fields to AppGroup"
```

---

## Task 3: UI — Rewrite GroupCard

**Files:**
- Modify: `components/home/GroupCard.tsx`

- [ ] **Step 1: Rewrite GroupCard**

Replace the entire file contents:

```tsx
import Image from "next/image";

interface GroupCardProps {
  title: string;
  location?: string;
  schedule?: string;
  imageSrc?: string;
  href?: string;
}

export function GroupCard({
  title,
  location,
  schedule,
  imageSrc = "/images/placeholder-image.png",
  href = "#",
}: GroupCardProps) {
  return (
    <a
      href={href}
      className="flex w-48 flex-shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-ink-300 bg-white active:opacity-80"
    >
      {/* 16:9 image */}
      <div className="relative aspect-video w-full">
        <Image
          src={imageSrc}
          alt=""
          fill
          className="object-cover"
          sizes="192px"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 p-3">
        <p className="text-[13px] font-semibold leading-snug text-ink-900 line-clamp-2">
          {title}
        </p>
        {location && (
          <p className="text-[11px] font-medium text-brand-600">{location}</p>
        )}
        {schedule && (
          <p className="text-[11px] leading-snug text-ink-600">{schedule}</p>
        )}
      </div>
    </a>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the dev server and check the home page**

```bash
npm run dev
```

Open http://localhost:3000. Scroll to "Join a group." The group cards should now have a top image (or placeholder) with name below. Location and schedule rows will be empty until the sync runs — this is expected.

- [ ] **Step 4: Commit**

```bash
git add components/home/GroupCard.tsx
git commit -m "feat: redesign GroupCard to match EventCard layout"
```

---

## Task 4: Docs, Webflow field, sync, and verify

**Files:**
- Modify: `docs/Development/groups-sync.md`
- Modify: `docs/Development/church-links.md`

- [ ] **Step 1: Update groups-sync.md field schema table**

Open `docs/Development/groups-sync.md`. Find the Webflow field table. Add a new row after `group-image-3`:

```
| `location` | PlainText | `group.city` (plain text mirror of the `city` Ref field) |
```

- [ ] **Step 2: Add session entry to church-links.md**

Open `docs/Development/church-links.md`. Add a new session entry at the top of the Recent Sessions section:

```markdown
### Session 05 (2026-05-31) — GroupCard layout redesign

**Goal:** Change GroupCard to match EventCard layout; show name, location, and meeting schedule.

**Solution:**
- Added `location` PlainText field to Webflow Groups collection (manual, via Webflow UI)
- Updated `transformGroupForWebflow` in `lib/sync/webflow-client.ts` to write `group.city` to `location`
- Updated `AppGroup` interface: removed `category`, added `location?` and `schedule?`
- Updated `getGroups()` to map `location` and `schedule-description` from Webflow
- Rewrote `GroupCard` to top-image + stacked-text layout matching `EventCard`

**Files Modified:**
- `lib/sync/webflow-client.ts` — added `location` field write
- `lib/__tests__/webflow-client.test.ts` — 2 new tests for `location` field
- `lib/webflow.ts` — updated `AppGroup`; updated `getGroups()` mapping
- `components/home/GroupCard.tsx` — full layout rewrite

**Status:** VERIFIED WORKING
```

- [ ] **Step 3: Add `location` field to Webflow (if not done yet)**

In the Webflow CMS UI, open the Groups collection settings and add a PlainText field with slug `location`. Save.

- [ ] **Step 4: Deploy and trigger sync**

Deploy the current branch to production (or preview), then trigger a manual sync to populate the new `location` field for all groups:

```bash
curl -X POST https://spirit-church-web-mobile.vercel.app/api/sync-groups \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected response includes `"updated": 36` (or similar).

- [ ] **Step 5: Verify in production**

Open https://spirit-church-web-mobile.vercel.app on mobile. Scroll to "Join a group." Group cards should show: image at top, group name, neighborhood (e.g., "North Phoenix"), and schedule (e.g., "Thursdays at 7:00 PM").

- [ ] **Step 6: Commit docs**

```bash
git add docs/Development/groups-sync.md docs/Development/church-links.md
git commit -m "docs: group card layout session + location field in groups-sync schema"
```
