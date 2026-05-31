# Design: Show Group Images in Home Carousel

**Date:** 2026-05-30  
**Status:** Approved  
**Workstream:** Church Links / Groups Sync

---

## Problem

`getGroups()` in `lib/webflow.ts` fetches the Webflow `groups` collection but does not read the `group-image` field. `AppGroup` has no `imageSrc` property, so `GroupCard` falls back to the placeholder image for every group even though images are now synced.

---

## Goal

Read `group-image` from the Webflow API response in `getGroups()` and pass it through to `GroupCard` so real group images appear in the "Join a group" carousel.

---

## Change

**`lib/webflow.ts` — two changes:**

1. Add `imageSrc?: string` to `AppGroup`:
```ts
export interface AppGroup {
  id: string;
  title: string;
  category: string;
  imageSrc?: string;
  href: string;
}
```

2. In the `getGroups()` map, add:
```ts
imageSrc: (item.fieldData["group-image"] as WfImage | null)?.url,
```

`WfImage` (`{ url: string; alt: string | null }`) is already defined at the top of `lib/webflow.ts` and used for events and header cards — no new types needed.

**No changes to `GroupCard` or `page.tsx`** — `GroupCard` already accepts `imageSrc?: string` with a placeholder fallback, and `page.tsx` already spreads the full group object onto `GroupCard` via `{...group}`.

---

## Webflow Image Field Behavior

Webflow Image fields set via the v2 API (plain URL string) are returned as `WfImage` objects (`{ url, alt }`) when read back. This matches the pattern used for `thumbnail-image` (events) and `background-image` (header cards). If for any reason the field comes back as a raw string instead, the `as WfImage | null` cast will silently produce `undefined` for `imageSrc` and `GroupCard` will fall back to the placeholder — no crash.

---

## Testing

No unit tests needed — `getGroups()` makes a live Webflow API call and is not unit-tested. Verify visually: run the dev server and confirm group images appear in the carousel for groups that have images synced.

---

## Out of Scope

- Changing the `GroupCard` layout or image dimensions
- Adding a loading skeleton for images
- Handling groups with no image differently than the current placeholder fallback
