---
name: Use Node 24 via nvm
description: User wants Node 24 as default; run "nvm use 24" before commands, not PATH hacks
type: feedback
---

Always use `nvm use 24` (via sourcing `/opt/homebrew/opt/nvm/nvm.sh`) instead of PATH manipulation for Node version.

**Why:** User explicitly corrected the PATH hack approach and asked to set Node 24 as default.

**How to apply:** Before running Node/pnpm commands, source nvm and use node 24. The alias is now set to default 24.
