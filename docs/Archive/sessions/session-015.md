# Archived Session — Outreach Sync Session 06

Archived from `docs/Development/outreach-sync.md` on 2026-07-01.

---

### Session 06 (2026-06-25) — Feature: Leader names and profile images

**Goal:** Add up to 2 leader names and photo URLs per outreach project, pulled from Rock RMS GroupMembers with a Leader role, synced through Supabase to Webflow CMS.

**Solution:**
- Added `RockRawGroupMember` interface and 4 new fields to `OutreachProject` (`leader_name`, `leader_name_2`, `leader_image`, `leader_image_2`)
- Added `fetchLeaderMap(groupIds)` to `OutreachRockClient` — one batch call to `/api/GroupMembers` expanded with Person and GroupRole, filters leaders client-side
- Wired into `fetchSignUpGroups()` via `Promise.all` alongside existing IdKey batch fetches; result passed into `transformProject()`
- Added 4 new columns to Supabase `outreach_projects` (TEXT, nullable); upsert spreads them automatically
- Added 4 PlainText fields to Webflow `outreach-projects` collection; `transformProjectForWebflow` writes them conditionally
- Name format: `(NickName || FirstName) + " " + LastName`

**Key decisions:**
- Client-side `IsLeader` filtering required: Rock's OData 100-node limit is exceeded when combining 20+ GroupId OR conditions with `and GroupRole/IsLeader eq true`. Fetch all members by GroupId, filter in JavaScript.
- Webflow slugs: Webflow assigned `leader-2-name` and `leader-2-profile-image` (not `leader-name-2` / `leader-profile-image-2` as expected) — code matches actual slugs.
- Leader photos are null: Rock returns `PhotoId` (int) on Person, not `Photo.Guid`. The `RockRawGroupMember` type has `Photo.Guid` typed as future-ready; add a comment noting it's always null until Rock exposes the URL.
- Supabase schema cache: must reload after adding new columns (`Project Settings → API → Reload schema cache`) before running sync, otherwise PostgREST silently ignores unknown fields in the upsert payload.

**Files Modified:**
- `lib/sync/outreach/types.ts` — added `RockRawGroupMember`, 4 new fields on `OutreachProject`
- `lib/sync/outreach/rock-client.ts` — added `fetchLeaderMap`, updated `transformProject` + `fetchSignUpGroups`
- `lib/sync/outreach/webflow-client.ts` — added 4 leader fields to `transformProjectForWebflow`
- `lib/__tests__/outreach-rock-client.test.ts` — 13 new tests
- `lib/__tests__/outreach-webflow-client.test.ts` — 3 new tests, updated `baseProject` fixture
- `docs/superpowers/specs/2026-06-25-outreach-leader-names-design.md` — design spec
- `docs/superpowers/plans/2026-06-25-outreach-leader-names.md` — implementation plan

**Status:** Deployed and verified — 143/143 tests passing, leader names live in Webflow
