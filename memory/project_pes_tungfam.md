---
name: PES Tung Fam webapp project
description: Vite+React web app at ~/git/pes-tungfam-webapp for processing PES 2021 TED files, uses bitten via neight adapter
type: project
---

Created a Vite + React 19 + TypeScript web app at `~/git/pes-tungfam-webapp` that replicates the tung-fam.mjs script from pes-ted as a browser tool.

**Why:** The user's friend needs to change player ID types in TED files. A web app is more accessible than a Node CLI script.

**How to apply:** When working on bitten, be aware this consumer exists and uses bitten in the browser with a Buffer polyfill. Breaking changes to bitten's API will affect this app. The app uses neight array format definitions (not bitten object format) — do not convert them.
