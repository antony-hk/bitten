# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build (outputs to dist/ as UMD and ESM)
pnpm build

# Run tests
pnpm test

# Type-check without building
pnpm exec tsc --noEmit

# Run a single example file
pnpm exec tsx examples/<filename>.ts
```

## Architecture

**Bitten** is a TypeScript library for parsing and constructing binary data. The entire library lives in `src/index.ts` (~1341 lines) and exports both a functional API and an OOP class.

### Build Output

`vite.config.ts` uses Vite 8 library mode to produce two bundles:
- `dist/bitten.js` — ESM
- `dist/bitten.umd.cjs` — UMD (CommonJS / browser global `bitten`)

### Core Concepts

**Format definition**: A plain object where each key is a field name and the value is a `FormatItem` describing the field's type, bit/byte layout, and optional transforms.

**Two APIs**:
- Functional: `toJS(buffer, format, options?)` and `fromJS(data, format, options?)` for direct conversion
- OOP: `new Bitten(format, options)` → `.fromBuffer(buf)` / `.toBuffer(obj)`

### `src/index.ts` Layout

| Lines | Section |
|-------|---------|
| 10–217 | TypeScript type system — `InferObjectFormat<T>` drives auto-inference of the shape returned by `toJS` |
| 225–241 | `readString` / `writeString` (UTF-8 via `TextEncoder`/`TextDecoder`) |
| 252–532 | `readBitsLE`, `writeBitsLE`, `readBitsBE`, `writeBitsBE` — bit-level I/O with masking/shifting |
| 539–692 | `parseFormat()` — validates & normalizes format definitions, sorts fields by binary position |
| 752–1130 | `toJS()` / `fromJS()` — main deserialization/serialization; handles arrays, nested `subFormat`, and `readTransform`/`writeTransform` hooks |
| 1138–1191 | Utility helpers: `getField`, `getFieldNames`, `calculateLength`, `createBuffer` |
| 1200–1253 | `writeBigInt64` / `readBigInt64` — manual 64-bit integer support |
| 1264–1341 | `Bitten` class — thin OOP wrapper around the functional API |

### Data Types

| Type | Alignment | Notes |
|------|-----------|-------|
| `boolean` | bit | `bitLength` must be 1 |
| `int` / `uint` | bit | variable bit length; supports both endiannesses |
| `bigint` | byte | must be byte-aligned; 64-bit only |
| `string` | byte | UTF-8 |
| `arraybuffer` | byte | raw binary |

Fields support `arrayLength` for repeating fields and `subFormat` for nested objects. Custom `readTransform`/`writeTransform` functions run during deserialization/serialization.

### Key Design Details

- Comments throughout `src/index.ts` are written in Cantonese (Traditional Chinese).
- `parseFormat()` must be called before `toJS`/`fromJS`; the `Bitten` class calls it in its constructor.
- Bit offsets accumulate across fields; `parseFormat` normalizes fractional bytes into `bitOffset` adjustments.
- `toJS` with `includeRaw: true` adds a `_raw` field (base64 string) per record for round-tripping.
- Uses Node `Buffer` API internally (`readUInt8`, `writeUInt8`, `Buffer.alloc`, `Buffer.concat`). Browser consumers need the `buffer` npm polyfill.

### Consumer Projects

- **neight** (`~/git/neight`) — Adapter layer that converts neight's array-based format definitions to bitten's object format. Used by pes-ted and pes-tungfam-webapp. Linked via `"bitten": "file:../bitten"`, which correctly resolves to this directory now that both repos sit side-by-side at `~/git/`.
- **pes-tungfam-webapp / pes-mushroom-webapp** (`~/git/pes-customized-webapp/`) — Vite + React 19 web apps for processing PES TED files. Both vendor bitten under `vendor/bitten/` (`"bitten": "file:vendor/bitten"`), so they are independent of where the bitten source tree lives.
- **pes-ted** (`~/git/pes-ted`) — Node.js project for PES binary data editing. Uses neight (original) for `bin2obj`/`obj2bin`.
