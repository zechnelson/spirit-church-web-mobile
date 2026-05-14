---
name: update-docs
description: Update project documentation after completing work, then commit and push to git.
---

# Update Project Documentation

Update project documentation after completing work, then commit and push.

## Instructions

1. **Gather session summary** if not already known from the conversation:
   - What was accomplished this session?
   - What files were modified?
   - Current status (verified working / awaiting testing)

2. **Identify the relevant Development doc(s):**
   - Match the work done to a workstream in the CLAUDE.md Workstream Status table
   - The target file is `docs/Development/<feature>.md`
   - If a new feature was implemented that has no Development doc yet, create one

3. **Read the target Development doc**

4. **Update the Development doc:**
   - Add a new session entry to the **Recent Sessions** section (keep rolling last 5)
   - If a 6th entry would be added, move the oldest to `docs/Archive/sessions/session-NNN.md`
   - Update any status, version numbers, or "what's working" sections

5. **Update CLAUDE.md if needed:**
   - Update the **Workstream Status** table if a workstream status changed
   - Update the **Documentation Table of Contents** if new docs were created

6. **Commit and push:**

   ```bash
   cd /Users/zechnelson/Documents/Tutorials/spirit-church-web-mobile
   git add docs/ CLAUDE.md
   git commit -m "docs: Session XX - description

   Co-Authored-By: Claude <noreply@anthropic.com>"
   git push origin main
   ```

## Session Entry Template

```markdown
### Session XX (YYYY-MM-DD) - Brief Title

**Goal/Problem:** What we set out to do or fix

**Solution:** How it was solved (with code snippets if relevant)

**Files Modified:**

- `path/to/file.ts` - Description of change

**Status:** VERIFIED WORKING / Awaiting Testing
```

## Example Usage

User: `/update-docs`

Claude reviews the conversation to determine:

1. Which workstream(s) were touched
2. What was accomplished
3. Which files were modified

Then updates the appropriate `docs/Development/<feature>.md` and CLAUDE.md as needed.

If the session summary is unclear, Claude asks:

> What was accomplished this session? Please provide:
>
> 1. Brief summary of the work
> 2. Files that were modified
> 3. Current status (verified working or needs testing)
