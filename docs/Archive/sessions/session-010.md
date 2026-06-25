# Archived Session — Outreach Sync / Session 01

**Source:** `docs/Development/outreach-sync.md`

### Session 01 (2026-06-09) — Implementation

**Goal:** Build full Rock RMS → Supabase → Webflow sync pipeline for Outreach Projects (Sign-Up Groups).

**Solution:** Implemented all 6 code tasks (types, rock-client, supabase-client, webflow-client, orchestrator, route handler) with TDD. 112/112 tests passing. Added cron entry to `vercel.json`. Supabase table created. Blocked on Webflow collection setup and Vercel env vars before deploying.

**Key decisions:**
- Flat Supabase schema (one row per opportunity, not normalized) — appropriate for 1:1 group:opportunity starting state
- `existingMap` keyed by `rock-opportunity-id` (not `rock-id`) since each Webflow item represents an opportunity
- Boolean fields (kids_welcome, handicap_accessible) stored as Webflow Switch, not Ref
- Sign-up URL is null if any IdKey is missing from Rock API response (graceful fallback)
- Rock attribute key names are guesses — must verify via diagnostic curl before first sync

**Files created:**
- `lib/sync/outreach/types.ts`, `rock-client.ts`, `supabase-client.ts`, `webflow-client.ts`, `index.ts`
- `app/api/sync-outreach/route.ts`
- `lib/__tests__/outreach-rock-client.test.ts`, `outreach-webflow-client.test.ts`, `outreach-sync-route.test.ts`

**Files modified:**
- `vercel.json` — added `/api/sync-outreach` cron entry
