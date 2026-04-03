# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build (outputs to dist/ as UMD and ESM)
npm run build

# Type-check without building
npx tsc --noEmit

# Run a single example file
npx ts-node examples/<filename>.ts
# or
node --loader ts-node/esm examples/<filename>.ts
```

There are no tests or lint commands configured.

## Architecture

**Bitten** is a TypeScript library for parsing and constructing binary data. The entire library lives in `src/index.ts` (~1341 lines) and exports both a functional API and an OOP class.

### Build Output

`build.js` uses esbuild to produce two bundles:
- `dist/bitten.js` — UMD (CommonJS / browser global `bitten`)
- `dist/bitten.mjs` — ESM

### Core Concepts

**Format definition**: A plain object where each key is a field name and the value is a `FormatItem` describing the field's type, bit/byte layout, and optional transforms.

**Two APIs**:
- Functional: `toJS(format, buffer, options)` and `fromJS(format, data, options)` for direct conversion
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
