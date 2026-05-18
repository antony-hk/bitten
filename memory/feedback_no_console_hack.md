---
name: No console.log hacking
description: User rejected overriding console.log to capture output; use separate logger instead
type: feedback
---

Do not override or monkey-patch `console.log` to capture output. Create a separate logger function instead.

**Why:** User explicitly said "please don't hack console.log" when I tried to override it.

**How to apply:** When needing to capture log output alongside console output, create a logger function that both console.logs and collects lines, rather than replacing console.log.
