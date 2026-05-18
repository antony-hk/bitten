---
name: Share strings, don't duplicate
description: User wants DRY strings — don't duplicate template literals across log.push() and console.log()
type: feedback
---

When a string needs to be used in multiple places (e.g., both pushed to an array and logged to console), compute it once and reuse it.

**Why:** User said "please share the same string" when I had the same template literal duplicated in `log.push(...)` and `console.log(...)`.

**How to apply:** Assign the string to a variable first, then use it in both places.
