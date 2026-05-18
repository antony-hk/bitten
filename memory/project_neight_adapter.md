---
name: Neight adapter role
description: ~/git/.personal/neight is now an adapter converting neight array format to bitten object format, not a standalone library
type: project
---

Neight was the original experimental version of bitten. It has been rewritten as a thin adapter layer that converts neight's array-based format definitions (`[{key, startByte, startBit, lengthInBit, ...}]`) to bitten's object format (`{fieldName: {offset, bitOffset, bitLength, ...}}`).

Key exports: `convertFormat()`, `bin2obj()` (alias for `toJS`), `obj2bin()` (alias for `fromJS`).

**Why:** pes-ted has many format files in neight's array format. Converting them all to bitten's object format would be too large a change. The adapter lets pes-ted continue working without modifications.

**How to apply:** When modifying bitten's API, ensure the neight adapter in `~/git/.personal/neight/src/index.js` still works. The adapter maps: `startByte→offset`, `startBit→bitOffset`, `lengthInBit→bitLength`, `isString→type:'string'`, `isSigned→type:'int'`, `getter→readTransform`, `setter→writeTransform`.
