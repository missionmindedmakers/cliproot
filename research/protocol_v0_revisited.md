# Protocol v0 Revisited (Draft)

Date: 2026-03-07  
Status: Draft proposal for implementation

## 1. Purpose

This revision combines:

- existing project goals from local research
- current standards terminology where it helps interoperability
- a deliberately simple v0 shape that can ship in a Notion-like editor

Primary product goals:

- every text span can carry provenance
- pasted/imported provenance survives transfer when available
- missing provenance triggers a user prompt
- users can visually distinguish human-authored, AI-generated, and derived text
- origin sources can track downstream reuse

## 2. What Changes From The Initial v0.1 Draft

Compared with `initial_proposed_protocol_schema_chatgpt.md`, this revision:

- adopts explicit PROV terminology (`Entity`, `Activity`, `Agent`) for conceptual alignment
- uses W3C Web Annotation selectors for span anchoring (`TextPositionSelector`, `TextQuoteSelector`)
- adds a controlled `sourceType` strategy aligned with IPTC Digital Source Type terms
- formalizes a destination-to-source reuse notification profile (Crossref Cited-by inspired)
- keeps signatures and C2PA export optional so the shipping v0 is not blocked by advanced trust infrastructure

## 3. Standards Baseline (Use, Do Not Overfit)

### 3.1 Core standards to reuse now

1. W3C PROV-O: use as the conceptual model
`Span = Entity`, `Edit/Paste/Generate = Activity`, `User/Model/System = Agent`.

2. W3C Web Annotation Data Model: use standard selectors for robust span references.

3. IPTC Digital Source Type: reuse terms for AI/human/synthetic classification.

4. Crossref Cited-by pattern: reuse the idea of forward-link discovery and optional callbacks for new citations/reuse.

### 3.2 Standards to align with later (optional in v0)

1. C2PA Content Credentials: export profile for signed document-level manifests.
As of C2PA 2.3 (approved September 2025), unstructured text support is still marked experimental and tooling support is limited, so treat as a future profile, not a v0 dependency.

2. ISCC / ISO 24138: optional content-derived IDs for cross-system deduplication.

3. RO-Crate / nanopublication patterns: optional packaging and fine-grained citation profile.

4. Story Protocol and other chain registries: optional public anchoring for document/package hashes.

## 4. Design Principles For v0

1. Editor is not source of truth.  
The editor stores references (`spanId`, `sourceRef`), while provenance records live in backend storage.

2. Preserve provenance by default.  
If incoming bundle has provenance, import it; if not, prompt user before finalizing paste.

3. Separate attribution from trust level.  
A claim can exist without signature; signature raises trust but is optional in v0.

4. Make cross-app transfer practical.  
Define one clipboard MIME payload with plain-text/HTML fallback.

5. Keep privacy explicit.  
Reuse notifications are policy-gated and consent-aware.

## 5. v0 Terminology

- `Agent`: person, organization, model, or service responsible for actions.
- `Entity`: a span or external source artifact.
- `Activity`: operation that used/generated entities.
- `Span`: attributed text segment inside a document.
- `SourceRecord`: canonical origin metadata for one origin unit.
- `ReuseEvent`: destination-side event describing downstream use.

## 6. Proposed v0 Data Shape

Protocol name (working): `ClipRoot Protocol` (`CRP`)  
Version: `0.0.1`

```json
{
  "protocolVersion": "0.0.1",
  "bundleType": "document|clipboard|reuse-event",
  "createdAt": "2026-03-07T15:20:00Z",
  "document": {
    "id": "doc_01J...",
    "title": "Example",
    "canonicalHash": "sha256-..."
  },
  "agents": [],
  "sources": [],
  "spans": [],
  "activities": [],
  "reuseEvents": [],
  "signatures": []
}
```

### 6.1 `Agent` (PROV Agent)

Required:

- `id`
- `type` (`person|organization|ai_model|service`)
- `displayName`

Optional:

- `did`
- `orcid`
- `model.vendor`
- `model.name`
- `model.version`

### 6.2 `SourceRecord` (origin metadata)

Required:

- `id`
- `sourceType`
- `attributedTo` (agent id)
- `createdAt`

Optional:

- `sourceUri` (URL/DOI/URN)
- `title`
- `license`
- `digitalSourceType` (IPTC URI)
- `evidence` (prompt hash, import evidence, capture metadata)
- `notify.endpoint` (source callback endpoint for reuse events)
- `notify.publicKey` (for signed callback verification)

Recommended `sourceType` values for v0:

- `human-authored`
- `ai-generated`
- `ai-assisted`
- `external-quoted`
- `unknown`

### 6.3 `Span` (PROV Entity)

Required:

- `id`
- `documentId`
- `selector`
- `textHash`
- `sourceRefs` (one or more source IDs)

Selector format (store both when possible):

- `textPosition`: `{ "start": 120, "end": 186 }`
- `textQuote`: `{ "exact": "...", "prefix": "...", "suffix": "..." }`
- `editorPath` (optional editor-native path for fast local mapping)

### 6.4 `Activity` (PROV Activity)

Required:

- `id`
- `type`
- `startedAt`
- `endedAt`
- `wasAssociatedWith` (agent id)
- `used` (entity/source IDs)
- `generated` (span IDs)

Recommended `type` values:

- `create`
- `paste`
- `import`
- `ai_generate`
- `edit`
- `transform`
- `summarize`

### 6.5 `ReuseEvent`

Required:

- `id`
- `sourceRef`
- `destinationDocumentId`
- `destinationAgentId`
- `observedAt`
- `status` (`detected|notified|acknowledged|rejected`)

Optional:

- `sourceSpanId`
- `destinationSpanId`
- `destinationUri`
- `notificationProof` (signed receipt, timestamp, key id)

## 7. Clipboard Transport Profile (v0 required)

MIME type:

- `application/x-provenance+json`

Clipboard payload:

```json
{
  "protocolVersion": "0.0.1",
  "bundleType": "clipboard",
  "origin": {
    "appId": "com.example.editor",
    "documentId": "doc_01J...",
    "exportedAt": "2026-03-07T15:30:00Z"
  },
  "spans": [],
  "sources": [],
  "activities": []
}
```

Fallback behavior:

1. also write `text/plain` and `text/html`
2. include `data-prov-span-id`/`data-prov-source-ref` hints in HTML where possible

Paste decision tree:

1. parse provenance bundle if present
2. validate required fields
3. if valid: preserve attributions and emit `ReuseEvent`
4. if missing/invalid: prompt user to classify origin before finalizing

## 8. Missing-Provenance Prompt (v0 required UX behavior)

When pasted content has no usable attribution, require explicit selection:

1. I wrote this content
2. AI generated this content
3. External source (URL/author)
4. Unknown for now

Result:

- create a new `SourceRecord`
- mark spans with that source
- optionally keep unresolved state if user chooses unknown

## 9. Rendering Profile (UI guidance)

Recommended default mappings:

- `human-authored`: red underline (or red text option)
- `ai-generated`: dashed underline + AI badge
- `external-quoted`: blue accent/quote style
- `ai-assisted` or mixed derivation: dual indicator
- `unknown`: yellow highlight until resolved

This is presentation policy, not protocol logic.

## 10. Reuse Tracking Handshake (v0.1 profile)

Destination workflow:

1. detect imported source refs
2. create `ReuseEvent`
3. if `notify.endpoint` exists and policy allows, POST signed event receipt

Source workflow:

1. verify signature (if present)
2. record downstream use
3. optionally send acknowledgment signature

This reproduces the useful part of citation graph behavior (forward links) without requiring blockchain.

## 11. Hashing And Identity Rules

For `textHash` in v0:

1. UTF-8 encode
2. normalize Unicode to NFC
3. normalize line endings to `\n`
4. hash with SHA-256
5. encode as base64url prefixed with `sha256-`

Optional:

- attach ISCC code for interoperable content-derived IDs

## 12. Security, Trust, Privacy

v0 minimum:

- signed provenance optional
- unsigned claims allowed but flagged as unverified
- reuse notifications configurable by workspace policy

Recommended:

- redact private source metadata on public exports
- support per-document privacy levels
- provide per-span visibility controls where feasible

## 13. Interop Mapping Cheatsheet

`CRP` to external standards:

- `Span` -> PROV `Entity`
- `Activity` -> PROV `Activity`
- `Agent` -> PROV `Agent`
- `sourceType` / `digitalSourceType` -> IPTC Digital Source Type terms
- document-level signed export -> C2PA claim/manifest profile
- package export -> RO-Crate/JSON-LD style bundle
- downstream citation tracking -> Crossref Cited-by style index/callback

## 14. Scope Boundaries (What v0 intentionally skips)

1. full decentralized identity stack
2. mandatory blockchain anchoring
3. legal licensing automation/royalty execution
4. full C2PA native embedding workflow
5. CRDT conflict-level provenance semantics

## 15. Suggested Build Sequence

1. Implement core `SourceRecord`, `Span`, `Activity`, `ReuseEvent` tables and APIs.
2. Implement clipboard bundle read/write and missing-provenance prompt.
3. Add source dashboard showing downstream uses.
4. Add optional signatures for event receipts.
5. Add export adapters (PROV JSON-LD, C2PA-style package, RO-Crate profile).

## 16. Open Product Decisions

1. Public vs private default for provenance records
2. Required vs optional source notification
3. Strict vs soft enforcement for unresolved provenance
4. AI prompt metadata retention policy (privacy vs auditability)
5. Global registry now vs local-first registry with later federation

## 17. References (primary sources)

1. W3C PROV-O Recommendation: https://www.w3.org/TR/prov-o/
2. W3C Web Annotation Data Model: https://www.w3.org/TR/annotation-model/
3. C2PA Specifications index: https://c2pa.org/specifications/
4. C2PA Specification 2.3 (approved 2025-09-16): https://c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html
5. IPTC guidance for AI-generated/synthetic media: https://iptc.org/news/iptc-publishes-metadata-guidance-for-ai-generated-synthetic-media/
6. IPTC Digital Source Type controlled vocabulary: https://cv.iptc.org/newscodes/digitalsourcetype/
7. Crossref Cited-by retrieve citations: https://www.crossref.org/documentation/cited-by/retrieve-citations/
8. ISCC (overview and standards context): https://iscc.io/
9. ISO 24138 record: https://www.iso.org/standard/77899.html
10. RO-Crate specification 1.2: https://www.researchobject.org/ro-crate/1.2/
11. Nanopublication guidelines (working draft): https://nanopub.net/guidelines/working_draft/
12. Story Protocol documentation: https://docs.story.foundation/
