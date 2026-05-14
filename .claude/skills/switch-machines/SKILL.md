---
name: switch-machines
description: Commit all uncommitted work and push to remote so you can pull on another machine.
---

# Switch Machines

Prepare the repository for switching to another machine by committing all uncommitted work and pushing to remote.

## Instructions

1. **Check for uncommitted changes:**

   ```bash
   cd /Users/zechnelson/Documents/Tutorials/spirit-church-web-mobile
   git status
   ```

2. **Commit everything (if there are changes):**

   ```bash
   cd /Users/zechnelson/Documents/Tutorials/spirit-church-web-mobile
   git add -A
   git commit -m "wip: switch machines checkpoint

   Co-Authored-By: Claude <noreply@anthropic.com>"
   git push origin main
   ```

3. **Verify push succeeded:**

   ```bash
   git status
   ```

4. **Provide pull instructions for the other machine:**

   ```
   cd ~/Documents/Tutorials/spirit-church-web-mobile
   git pull origin main
   npm install
   ```

## Output

After completing, inform the user:

> All changes pushed! On your other machine, run:
>
> ```bash
> git pull origin main
> npm install
> ```

## Notes

- If there are no uncommitted changes, just confirm the repo is up to date.
- `.env.local` is gitignored — copy it manually to your other machine if needed.
