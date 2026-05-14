# Spirit Church Web Mobile

## Quick Reference

| Item        | Value                                                                              |
| ----------- | ---------------------------------------------------------------------------------- |
| Project     | spirit-church-web-mobile                                                           |
| GitHub      | zechnelson/spirit-church-web-mobile                                                |
| Description | A mobile-first website for viewing upcoming events, church links, and taking sermon notes live in-person. |

## Development Environment

```
spirit-church-web-mobile/
├── docs/                   ← All project documentation (see TOC below)
├── scripts/                ← Utility scripts
├── .claude/                ← Claude Code config + skills
│   └── skills/             ← Slash command definitions
├── CLAUDE.md               ← This file (entry point)
└── .gitignore
```

## Git Workflow

### Common Git Mistakes to Avoid

1. **Staging sensitive files** — `.env` and `.env.local` are in `.gitignore`; never force-add them.
2. **Committing `node_modules/` or `.next/`** — Both are excluded; don't override `.gitignore`.
3. **Running `git add -A` without reviewing** — Always `git add` specific paths to avoid accidentally staging build artifacts.

## Workstream Status

| System              | Status   | Doc                                    |
| ------------------- | -------- | -------------------------------------- |
| Events              | PLANNING | `docs/Development/events.md`           |
| Sermon Notes        | PLANNING | `docs/Development/sermon-notes.md`     |
| Church Links        | PLANNING | `docs/Development/church-links.md`     |
| Auth / User Account | PLANNING | `docs/Development/auth.md`             |

## Documentation Table of Contents

**IMPORTANT:** Read docs on-demand based on task. Do NOT read all docs every session.

### Discovery/ — Business context & product info

| File                  | Description                                  |
| --------------------- | -------------------------------------------- |
| `project-overview.md` | Project description, goals, key stakeholders |

### Frameworks/ — Tech stack & infrastructure

| File            | Description                                |
| --------------- | ------------------------------------------ |
| `tech-stack.md` | Languages, frameworks, tools with versions |

### PRDs/ — Feature requirements

| File | Description |
| ---- | ----------- |

<!-- Add PRDs as features are planned -->

### Architecture/ — System design & patterns

| File | Description |
| ---- | ----------- |

<!-- Add architecture docs as systems are designed -->

### Design/ — Visual design system

| File | Description |
| ---- | ----------- |

<!-- Add design docs as brand/UI is defined -->

### Development/ — One file per feature/system

| File | Description |
| ---- | ----------- |

<!-- Add development docs as features are built -->

### Debug/ — Troubleshooting

| File | Description |
| ---- | ----------- |

<!-- Add debug guides as issues are solved -->

### Analytics/ — Marketing & data

| File | Description |
| ---- | ----------- |

<!-- Add analytics docs as reports are created -->

### Tests/ — QA & testing

| File | Description |
| ---- | ----------- |

<!-- Add test docs as QA processes are defined -->

### Feedback/ — Decisions & retrospectives

| File               | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `decisions-log.md` | Key architectural and product decisions with rationale |

### _data/ — Data files & output

| Folder | Description |
| ------ | ----------- |

<!-- Add data folders as they're created -->

### Archive/ — Historical reference

| Subdirectory | Contents                                                |
| ------------ | ------------------------------------------------------- |
| `sessions/`  | Archived session notes (overflow from Development docs) |

## Context Loading

**IMPORTANT — Docs-First Approach:** When starting any task, always consult project docs BEFORE launching broad codebase searches or explore agents:

1. Match the request to a workstream in the Workstream Status table above
2. Read the corresponding `docs/Development/<feature>.md` — it lists key files, architecture, and current status
3. If a PRD exists at `docs/PRDs/<feature>.md`, read it too — it defines requirements, scope, and key decisions
4. Do targeted reads of the specific files listed in those docs
5. Only use explore agents for discovering things NOT already documented

The Documentation TOC, PRDs, and Development docs exist to avoid expensive broad codebase searches. Don't rediscover what's already written down.

## Slash Commands

| Command            | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `/update-docs`     | Update project documentation after completing work, then commit and push |
| `/sync-repos`      | Pull latest from all repos and sync submodules after switching machines  |
| `/switch-machines` | Commit all uncommitted work and push so you can pull on another machine  |
| `/session-context` | Load context for a specific workstream to continue development           |

## Context Checkpoint Rule

**IMPORTANT:** Before context runs out, proactively save session progress.

**When to checkpoint (any of these):**

- After completing a significant feature or fix
- After 3+ file edits in a session
- Before reading large files (>500 lines)
- When user confirms a fix is working

**How to checkpoint:**

1. Commit all modified files with descriptive message
2. Update the relevant `docs/Development/<feature>.md` with session entry
3. Push to main

**If context is critically low:**

- Immediately commit any uncommitted work
- Write a brief session summary to the relevant Development doc
- Inform user: "Context is running low. I've saved progress. Start a new session with `/session-context <workstream>` to continue."

## Session Update Workflow

After each session:

1. Update the relevant `docs/Development/<feature>.md` with work done
2. Keep a "Recent Sessions" section in each dev doc (rolling last 5 entries)
3. When 6th entry is added, move the oldest to `docs/Archive/sessions/session-NNN.md`
4. Update the Workstream Status table above if status changed
5. Update the TOC above if new docs were created
6. Commit docs alongside code changes

## Creating New Features

When planning a new feature:

1. Create a PRD first in `docs/PRDs/<feature>.md` (Purpose, Requirements, Key Decisions, Scope, Status)
2. After implementation begins, create `docs/Development/<feature>.md` for implementation details
3. Add both to the TOC and Workstream Status table in this file

When modifying an existing feature:

1. Read the existing PRD (if one exists) and Development doc before planning
2. Update the PRD if requirements or scope changed
3. Update the Development doc with a session entry after implementation
