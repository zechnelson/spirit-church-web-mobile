# Design: Sync Group Image to Webflow

**Date:** 2026-05-30  
**Status:** Approved  
**Workstream:** Groups Sync

---

## Problem

`group_image` is fetched from Rock RMS and stored on `SyncGroup`, but `transformGroupForWebflow` never includes it in the Webflow PATCH/POST payload. Group images are absent from all Webflow CMS items.

---

## Goal

Populate the `group-image` field in Webflow CMS for every group that has an image URL in Rock RMS.

---

## Source

Rock RMS returns a GUID in `AttributeValues.GroupImageThumbnail.Value`. `getImageUrl()` in `utils.ts` converts this to:

```
https://rms.spiritchurch.co/GetImage.ashx?guid=<guid>
```

This URL is already stored as `SyncGroup.group_image` (string | null).

---

## Change

In `transformGroupForWebflow` in `lib/sync/webflow-client.ts`, add one conditional after the existing optional fields:

```ts
if (group.group_image) fieldData["group-image"] = group.group_image;
```

Webflow Image fields in the v2 API accept a plain URL string — Webflow fetches and caches it server-side. If `group_image` is `null`, the field is omitted (same pattern as all other optional fields). No changes to types, the Rock client, or the orchestrator.

---

## Webflow Field

| Field slug | Type | Source |
| ---------- | ---- | ------ |
| `group-image` | Image | `group.group_image` (URL string) |

Add this row to the Webflow Collection field table in `docs/Development/groups-sync.md`.

---

## Testing

In `lib/__tests__/webflow-client.test.ts`:

- Add `group_image: "https://rms.spiritchurch.co/GetImage.ashx?guid=abc"` to a test group and assert `fieldData["group-image"]` equals that URL
- Add a case where `group_image` is `null` and assert `fieldData` does not contain `"group-image"`

---

## Out of Scope

- Downloading or re-hosting the image (Webflow handles this)
- Image resizing or format conversion
