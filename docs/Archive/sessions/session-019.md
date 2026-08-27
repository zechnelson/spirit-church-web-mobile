# Session 019 — Church Links: Group images in home carousel (archived from church-links.md)

### Session 04 (2026-05-30) — Group images in home carousel

**Goal:** Show real group images in the "Join a group" carousel instead of a placeholder.

**Solution:** Added `imageSrc?: string` to the `AppGroup` interface and mapped `item.fieldData["group-image"]` as `WfImage` in `getGroups()`. `GroupCard` already accepted `imageSrc?` with a placeholder fallback — no component changes needed. `page.tsx` already spreads `{...group}` onto `GroupCard` — no page changes needed.

**Files Modified:**
- `lib/webflow.ts` — added `imageSrc` to `AppGroup`; mapped `group-image` in `getGroups()`

**Status:** VERIFIED WORKING (requires sync to have run since `group-image` field was added)
