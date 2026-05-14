---
name: session-context
description: Load detailed context for specific workstreams to continue development.
argument-hint: "[workstream-name]"
---

# Load Session Context

Load detailed context for a specific workstream to continue development.

## Instructions

1. **Determine which workstream to load.** If an argument was provided, match it to a workstream in the CLAUDE.md Workstream Status table. If not, list available workstreams and ask the user.

2. **Read the relevant docs in this order:**
   - `docs/Development/<feature>.md` — Primary source: implementation details, recent sessions, current status
   - `docs/PRDs/<feature>.md` — Requirements context (if it exists)
   - `docs/Architecture/<topic>.md` — System design context (only if the work touches cross-cutting concerns)

3. **Summarize the current state** for the user:

   > **Workstream: [Name]**
   > **Status:** [from CLAUDE.md Workstream Status table]
   >
   > **Recent Work:**
   >
   > - [from last session entry in Development doc]
   >
   > **What's Working:**
   >
   > - [bullet points]
   >
   > **Next Priority Tasks:**
   >
   > 1. [task]
   > 2. [task]
   >
   > What would you like to work on?

4. **Do NOT read all docs.** Only load what's needed for the specified workstream.

## Workstream Lookup

| User Input                        | Development Doc                          |
| --------------------------------- | ---------------------------------------- |
| `events`                          | `docs/Development/events.md`             |
| `notes`, `sermon`, `sermon-notes` | `docs/Development/sermon-notes.md`       |
| `links`, `church-links`           | `docs/Development/church-links.md`       |
| `auth`, `login`, `user`           | `docs/Development/auth.md`               |

## Usage Examples

- `/session-context events` — Load events workstream context
- `/session-context sermon-notes` — Load sermon notes workstream context
- `/session-context` — List available workstreams and ask which to load
