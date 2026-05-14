# Decisions Log

Record key architectural and product decisions with rationale so future sessions understand _why_ things are the way they are.

## Template

### YYYY-MM-DD — Decision Title

**Context:** What situation prompted this decision?
**Decision:** What was decided?
**Rationale:** Why this approach over alternatives?
**Consequences:** What trade-offs were accepted?

## Decisions

### 2026-05-14 — Tech Stack Selection

**Context:** Starting a new mobile-first church web app from scratch.
**Decision:** Next.js 15 + React + Tailwind + shadcn/ui + Supabase.
**Rationale:** Next.js gives a fast, SEO-friendly mobile web experience with App Router. Supabase handles auth and real-time (useful for sermon notes syncing). shadcn/ui provides accessible, composable components without heavy lock-in.
**Consequences:** Requires Supabase project setup before auth or data features can be built. App Router is the default — avoid Pages Router patterns.
