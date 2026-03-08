# `@cliproot/protocol`

`@cliproot/protocol` provides the Week 1 foundation for ClipRoot Protocol (CRP) `v0.0.1`:

- schema-backed bundle validation
- typed protocol interfaces derived from the schema
- deterministic text hashing helpers (`sha256-<base64url>`)

## Install

```bash
pnpm add @cliproot/protocol
```

## Usage

```ts
import { createTextHash, parseBundle, validateBundle } from '@cliproot/protocol';

const result = validateBundle(payload);
if (!result.ok) {
  console.error(result.errors);
}

const parsed = parseBundle(payload);
const textHash = createTextHash('Provenance starts here.');
```

## Schema Source of Truth

Canonical schema source lives in:

- `../../schema/crp-v0.0.1.schema.json`
- `../../schema/examples/crp-v0.0.1.document.example.json`

Use:

```bash
pnpm --filter @cliproot/protocol schema:sync
pnpm --filter @cliproot/protocol schema:check
```
