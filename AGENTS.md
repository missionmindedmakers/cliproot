# ClipRoot — Agent Quick Reference

**ClipRoot** is an open protocol for provenance-aware content reuse. CRP models provenance as a DAG of clips (text + hash) and edges, enabling traceable attribution as content moves between documents and AI systems. This repo contains the canonical JSON Schemas, protocol specs, TypeScript/browser SDK, and reference registry.

## Tech Stack

- **Package manager**: pnpm 10.x (strictly enforced by `packageManager` in root)
- **Monorepo**: Turborepo 2.x with workspace: `packages/*`, `apps/*`
- **Runtime**: Node.js ≥22
- **Languages**: TypeScript 5.7
- **Testing**: Vitest
- **Formatting**: Prettier

## Quick Commands

```bash
# Install dependencies
pnpm install

# Build all packages (respects dependency graph)
pnpm build

# Typecheck and test everything
pnpm typecheck
pnpm test

# Format code
pnpm format

# Run specific package commands
pnpm --filter @cliproot/protocol build
pnpm --filter @cliproot/registry dev      # registry server on :3002
pnpm --filter @cliproot/playground dev    # playground on :5173
pnpm --filter @cliproot/extension dev     # Chrome extension dev build
```

## Monorepo Structure

| Path | Purpose |
|------|---------|
| `schema/` | **Canonical CRP JSON Schemas** — source of truth for the protocol |
| `spec/` | Human-readable protocol specification (protocol, hashing, pack-format, registry, conformance) |
| `packages/protocol/` | `@cliproot/protocol` — schema validation (AJV), TS types, deterministic hashing, constants |
| `packages/core/` | `@cliproot/core` — browser SDK for capturing clipboard provenance on copy events |
| `packages/tiptap/` | `@cliproot/tiptap` — Tiptap editor extension for span-level attribution |
| `packages/extension/` | `@cliproot/extension` — browser extension (WXT, MV3) that auto-captures on copy |
| `packages/registry-client/` | `@cliproot/registry-client` — HTTP client for the CRP Registry Protocol |
| `apps/playground/` | `@cliproot/playground` — web app for inspecting clips and visualizing lineage |
| `apps/registry/` | `@cliproot/registry` — CRP Registry reference server (Hono + SQLite) |

## Package Dependency Chain

```
protocol (base) → core → extension, tiptap → playground
                      → registry-client
protocol → registry (server)
```

## Key Conventions

- **Schema source of truth**: `schema/crp-v0.0.3.schema.json`. The `packages/protocol/schema/` directory is kept in sync via `pnpm --filter @cliproot/protocol schema:sync`
- **Hash format**: All content hashes are `sha256-{base64url_no_pad}` (see `spec/hashing.md`)
- **Bundle types**: `document`, `clipboard`, `derivation`, `reuse-event`, `provenance-export`
- **Protocol version**: CRP v0.0.3 (Draft)

## Where to Find Things

| Task | Location |
|------|----------|
| Add new schema version | `schema/crp-v*.schema.json` → sync to `packages/protocol/` |
| Change hashing logic | `packages/protocol/src/hash.ts` |
| Change validation | `packages/protocol/src/validate.ts` |
| Browser capture logic | `packages/core/src/` |
| Registry API routes | `apps/registry/src/routes.ts` |
| Registry data layer | `apps/registry/src/db.ts`, `src/blob-store.ts` |
| Playground UI | `apps/playground/src/` (Vite + vanilla TS) |

## Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @cliproot/protocol test
```

## Schema Sync Check

```bash
pnpm --filter @cliproot/protocol schema:check   # CI check
pnpm --filter @cliproot/protocol schema:sync    # Sync schema/ to package
```

## Related Repository

The Rust implementation (CLI, MCP server, SQLite storage) lives at [`cliproot/cliproot_rust`](https://github.com/cliproot/cliproot_rust). It is usually checked out in an adjacent directory cliproot_rust.
