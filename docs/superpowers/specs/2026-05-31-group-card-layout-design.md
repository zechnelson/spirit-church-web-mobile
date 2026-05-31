# Group Card Layout Redesign

**Date:** 2026-05-31
**Status:** Approved

## Goal

Change GroupCard to match the EventCard layout (top image + stacked text), and surface group name, location, and meeting schedule as the displayed details.

## Layout Change

GroupCard flips from its current horizontal layout (side thumbnail + text) to a vertical layout identical to EventCard:

- Card width: `w-48` (up from `w-44`)
- Structure: `aspect-video` image at top, content block below
- Content block (`p-3`, `gap-1`):
  - **Row 1 — Name:** `text-[13px] font-semibold text-ink-900 line-clamp-2`
  - **Row 2 — Location:** `text-[11px] text-brand-600 font-medium` (same style as date in EventCard)
  - **Row 3 — Schedule:** `text-[11px] leading-snug text-ink-600` (same style as subtitle in EventCard)
- Removes: side thumbnail div, category pill

## Data Changes

### `AppGroup` interface (`lib/webflow.ts`)

Add two optional fields:

```ts
export interface AppGroup {
  id: string;
  title: string;
  location?: string;   // new — city/neighborhood (e.g. "North Phoenix")
  schedule?: string;   // new — meeting schedule (e.g. "Thursdays at 7:00 PM")
  imageSrc?: string;
  href: string;
  // category removed (no longer displayed)
}
```

### `getGroups()` mapping (`lib/webflow.ts`)

Map two new Webflow PlainText fields:

```ts
location: (item.fieldData["location"] as string | null) ?? undefined,
schedule: (item.fieldData["schedule-description"] as string | null) ?? undefined,
```

Remove `category: "Small Group"` (no longer used by the card).

### `GroupCard` props

```ts
interface GroupCardProps {
  title: string;
  location?: string;
  schedule?: string;
  imageSrc?: string;
  href?: string;
}
```

## Webflow + Sync Changes

### Step 1 — Add Webflow field (manual, done before code ships)

Add a PlainText field named `location` (slug: `location`) to the Groups collection in the Webflow CMS UI. This follows the same pattern as `group-image-3`.

### Step 2 — Update sync (`lib/sync/webflow-client.ts`)

In `transformGroupForWebflow`, write the city name to the new field:

```ts
if (group.city) fieldData["location"] = group.city;
```

### Step 3 — Trigger manual sync

After the Webflow field is added, trigger a manual sync via POST `/api/sync-groups` so the `location` field is populated for all existing groups.

### Step 4 — Update docs

Add `location` to the Webflow field schema table in `docs/Development/groups-sync.md`.

## Scope

**In scope:**
- `GroupCard.tsx` — layout rewrite
- `lib/webflow.ts` — `AppGroup` interface + `getGroups()` mapping
- `lib/sync/webflow-client.ts` — sync write for `location` field
- `docs/Development/groups-sync.md` — field table update

**Out of scope:**
- `page.tsx` — no changes needed (`{...group}` spread already passes all props)
- Webflow field addition — done manually in Webflow UI before deploy
