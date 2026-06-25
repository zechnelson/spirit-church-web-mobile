# Archived Session — Outreach Sync / Session 02

**Source:** `docs/Development/outreach-sync.md`

### Session 02 (2026-06-11) — Webflow Collection

**Goal:** Create Webflow CMS collection for Outreach Sync pipeline (Task 0, Step 1).

**What happened:** Initially created collections on wrong site (Spirit Church Staging `68bf98e2590d4a39fb6f9bb8`). Correct site is `68ae1c452c9ac726c7a745ee`. After reconnecting Webflow MCP, hit the 20-collection CMS plan limit — couldn't create 4 reference collections. Changed architecture: campus/event/category/city are now PlainText fields on `outreach-projects` instead of Reference fields.

**Solution:** Added all 16 fields to existing `outreach-projects` collection (`6a28cbac65cb0f0593f53802`) on correct site. Field slugs all match the schema.

**Key decisions:**
- campus/event/category/city changed from Ref to PlainText — Spirit Church site is at 20-collection CMS plan limit
- Eliminates campusMap/eventMap/categoryMap/cityMap lookups in webflow-client.ts — simpler sync, string values written directly
- Wrong-site collections (on `68bf98e2590d4a39fb6f9bb8`) must be manually deleted in Webflow Designer
