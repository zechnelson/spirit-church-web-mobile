---
name: sync-repos
description: Pull latest from all repos after switching machines.
---

# Sync Repos

Pull the latest changes after switching to this machine.

## Instructions

1. **Pull the main repo:**

   ```bash
   cd /Users/zechnelson/Documents/Tutorials/spirit-church-web-mobile
   git pull origin main
   ```

2. **Install dependencies if package.json changed:**

   ```bash
   npm install
   ```

3. **Report what changed** — summarize the git pull output (files changed, new additions).

## Output

After completing, confirm:

> Repo synced. [summary of changes]
