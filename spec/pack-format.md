# CRP Pack Format Specification

**Version:** cliproot-pack-v1

---

## Overview

A `.cliprootpack` file is a portable archive for exchanging CRP provenance data between repositories. It bundles clips, their full derivation lineage, associated artifacts, and metadata into a single compressed file that can be imported into any ClipRoot repository.

Packs are self-describing: the manifest contains all metadata needed to validate and import the archive without consulting an external repository.

---

## Archive Format

A `.cliprootpack` file is a **tar archive compressed with Zstandard** (tar.zst).

The archive contains the following structure:

```
manifest.json
objects/<bundle-hash>.json
objects/<bundle-hash>.json
...
artifacts/<artifact-hash>
artifacts/<artifact-hash>
...
```

| Path | Content |
|---|---|
| `manifest.json` | Pack manifest (see below) |
| `objects/*.json` | CRP bundle JSON files, one per bundle |
| `artifacts/*` | Raw artifact bytes, one per artifact |

---

## Manifest

The manifest (`manifest.json`) is the authoritative source for all pack metadata. Its schema is defined in `schema/cliproot-pack-v1.manifest.schema.json`.

```json
{
  "format": "cliproot-pack-v1",
  "createdAt": "2026-03-07T21:00:00Z",
  "project": {
    "id": "proj_auth_refactor",
    "name": "Auth Refactor"
  },
  "roots": {
    "mode": "project",
    "projectId": "proj_auth_refactor",
    "clipHashes": ["sha256-aaa...", "sha256-bbb..."]
  },
  "counts": {
    "bundles": 3,
    "clips": 5,
    "edges": 4,
    "artifacts": 2,
    "links": 2
  },
  "objects": [
    {
      "bundleHash": "sha256-...",
      "archivePath": "objects/sha256-....json",
      "byteSize": 1842,
      "sha256Digest": "sha256-...",
      "clipHashes": ["sha256-aaa..."]
    }
  ],
  "artifacts": [
    {
      "artifactHash": "sha256-...",
      "artifactType": "markdown",
      "fileName": "plan.md",
      "mimeType": "text/markdown",
      "byteSize": 42,
      "sha256Digest": "sha256-...",
      "archivePath": "artifacts/sha256-..."
    }
  ],
  "clipArtifactRefs": [
    {
      "clipHash": "sha256-aaa...",
      "artifactHash": "sha256-...",
      "relationship": "cited_in"
    }
  ]
}
```

### Required Fields

- `format` — must be the string `"cliproot-pack-v1"`.
- `createdAt` — ISO 8601 timestamp of pack creation.
- `roots` — describes what was included and why.
- `counts` — summary counts for quick validation.
- `objects` — manifest entries for each bundled CRP object.
- `artifacts` — manifest entries for each included artifact.
- `clipArtifactRefs` — links between clips and artifacts.

### Roots

The `roots` object describes the selection criteria used to build the pack:

| Mode | Behavior |
|---|---|
| `project` | All clips tagged with `projectId`, plus full ancestor closure, plus all project artifacts. `projectId` is required. |
| `roots` | Specific clips listed in `clipHashes`, plus ancestor closure up to a requested depth, plus only artifacts reachable through `clipArtifactRefs`. |

`clipHashes` lists the root clip hashes that were used as starting points. For project mode, this is populated with all project-tagged clips.

---

## Inclusion Rules

### Project Packs (`roots.mode = "project"`)

Include:
1. All clips tagged with the project ID.
2. Full `wasDerivedFrom` ancestor closure (all ancestors, unlimited depth).
3. All artifacts tagged with the project ID.
4. All `clipArtifactRefs` for included clips.
5. All edges, agents, sources, activities, and documents referenced by included clips.

### Root Packs (`roots.mode = "roots"`)

Include:
1. The explicitly requested root clips.
2. `wasDerivedFrom` ancestor closure up to the requested depth.
3. Artifacts reachable through `clipArtifactRefs` of included clips.
4. All edges, agents, sources, activities, and documents referenced by included clips.

---

## Object Entries

Each object entry in the manifest describes a CRP bundle file in the archive:

| Field | Description |
|---|---|
| `bundleHash` | Content hash of the bundle JSON bytes |
| `archivePath` | Path within the archive (e.g., `objects/sha256-....json`) |
| `byteSize` | Size of the JSON file in bytes |
| `sha256Digest` | SHA-256 hash of the archived bytes |
| `clipHashes` | Clip hashes contained in this bundle |

The archive path pattern is: `objects/<bundle-hash>.json`

---

## Artifact Entries

Each artifact entry describes a raw file in the archive:

| Field | Description |
|---|---|
| `artifactHash` | Content hash of the artifact bytes |
| `artifactType` | Type classification (markdown, prompt, session, etc.) |
| `fileName` | Original file name |
| `mimeType` | MIME type |
| `byteSize` | Size in bytes |
| `sha256Digest` | SHA-256 hash of the archived bytes |
| `archivePath` | Path within the archive (e.g., `artifacts/sha256-...`) |

Optional fields: `id`, `projectId`, `metadata`, `createdAt`.

---

## Verification

A pack is valid if and only if all of the following hold:

1. **Format check.** `manifest.format` is `"cliproot-pack-v1"`.
2. **Completeness.** Every `archivePath` in the manifest has a corresponding entry in the tar archive.
3. **Byte size.** Every entry's `byteSize` matches the actual archived bytes.
4. **Digest integrity.** Every entry's `sha256Digest` matches the SHA-256 hash of the archived bytes.
5. **Bundle validity.** Every CRP bundle in `objects/` deserializes as valid JSON and passes CRP bundle validation (schema conformance + hash verification).
6. **Artifact integrity.** Every artifact's raw bytes hash to both `sha256Digest` and `artifactHash`.
7. **Count consistency.** `counts.bundles`, `counts.clips`, `counts.edges`, `counts.artifacts`, and `counts.links` match the actual content of the archive.

---

## Compression

Packs use Zstandard (zstd) compression at level 3 by default. Implementations should use a standard zstd library and should accept any valid zstd compression level when reading.

---

## Schema Reference

- Manifest schema: `schema/cliproot-pack-v1.manifest.schema.json`
- Example manifest: `schema/examples/cliproot-pack-v1.manifest.example.json`
