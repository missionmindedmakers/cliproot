# High-Level Plan (March 7, 2026)

## 1) Executive Summary

This plan combines:

- product and implementation direction from `high_level_brainstorm_chatgpt.md`
- data-model foundations from `initial_proposed_protocol_schema_chatgpt.md`
- terminology and standards alignment from `protocol_v0_revisited.md`

Resulting strategy:

1. Ship an open protocol + SDK ecosystem that is database/UI-framework agnostic.
2. Ship a closed-source cloud application that demonstrates end-to-end workflows (authoring, attribution, reuse tracking, and source notifications).
3. Use standards-aligned terminology now (PROV/Web Annotation/IPTC/Crossref-inspired) without blocking v0 on advanced trust infrastructure (C2PA embedding, chain anchoring, full DID stack).

---

## 2) Product Scope and Packaging

### 2.1 Open-source libraries (public)

Monorepo target:

- `@cliproot/protocol` (core schema, validation, hashing, MIME serialization, event models)
- `@cliproot/tiptap` (editor extension for marks, copy/paste hooks, span attribution commands)
- `@cliproot/handshake` (reuse event emission/verification helpers)
- Optional adapters: `@cliproot/react`, `@cliproot/vue`, `@cliproot/angular`

Design constraint:

- no hard dependency on any specific database, auth provider, or cloud host

### 2.2 Cloud application (initially closed source)

Purpose:

- showcase primary user workflows and network effects

Baseline stack:

- Next.js + Tiptap frontend
- route handlers/server actions backend
- Postgres + Drizzle ORM
- authenticated identities (e.g., BetterAuth)

Core showcase workflows:

1. Create/edit documents with span-level attribution.
2. Paste/import with provenance preservation when available.
3. Trigger required missing-provenance prompt when unavailable.
4. Track downstream reuse and source notifications.
5. Explore public/private attribution graph views with policy controls.

---

## 3) Terminology Update (v0 Canonical Vocabulary)

Adopt this model in protocol docs, APIs, and DB naming (UI labels can remain user-friendly):

- `Agent` (PROV Agent): person, org, AI model, or service
- `Entity` (PROV Entity): span or source artifact
- `Activity` (PROV Activity): create/paste/import/edit/ai_generate/etc.
- `Span`: attributed text entity in a document
- `SourceRecord`: canonical origin metadata record (replaces generic cliproot-record naming in protocol-facing surfaces)
- `ReuseEvent`: destination-side downstream-use record

Recommended `sourceType` values for v0:

- `human-authored`
- `ai-generated`
- `ai-assisted`
- `external-quoted`
- `unknown`

Optional interoperability field:

- `digitalSourceType`: IPTC Digital Source Type URI

---

## 4) Standards Baseline and Positioning

### 4.1 Reuse now (v0 requirements)

1. W3C PROV-O as conceptual model:
   - Span -> Entity
   - Edit/Paste/Generate -> Activity
   - User/Model/System -> Agent
2. W3C Web Annotation selectors for span anchoring:
   - `TextPositionSelector`
   - `TextQuoteSelector`
   - optional `editorPath` for fast editor-native lookup
3. IPTC Digital Source Type alignment for source classification.
4. Crossref Cited-by inspired forward-link/reuse notification profile.

### 4.2 Defer to later profiles (not v0 blockers)

- C2PA signed manifest export/profile
- ISCC / ISO 24138 identifiers
- RO-Crate / nanopublication packaging
- Story Protocol / chain anchoring

Important implementation stance:

- attribution claims are allowed unsigned in v0
- signatures increase trust but are optional

---

## 5) Protocol Profile (CRP v0.0.1)

Working protocol:

- Name: `ClipRoot Protocol` (`CRP`)
- Version: `0.0.1`
- Bundle types: `document | clipboard | reuse-event`

Top-level shape:

```json
{
  "protocolVersion": "0.0.1",
  "bundleType": "document|clipboard|reuse-event",
  "createdAt": "2026-03-07T15:20:00Z",
  "document": {},
  "agents": [],
  "sources": [],
  "spans": [],
  "activities": [],
  "reuseEvents": [],
  "signatures": []
}
```

### 5.1 Clipboard transport profile (required)

- MIME type: `application/x-provenance+json`
- also include `text/plain` + `text/html` fallbacks
- add HTML hints: `data-prov-span-id`, `data-prov-source-ref`

Paste decision tree:

1. parse provenance MIME bundle
2. validate required fields
3. if valid: preserve attribution and emit `ReuseEvent`
4. if missing/invalid: show missing-provenance prompt before finalizing paste

### 5.2 Missing-provenance UX (required)

Prompt options:

1. I wrote this content
2. AI generated this content
3. External source (URL/author)
4. Unknown for now

Outcome:

- create `SourceRecord`
- attach selected source to imported spans
- unresolved spans can remain `unknown`

### 5.3 Span anchoring and identity (required)

For each span store:

- `textPosition` selector (start/end)
- `textQuote` selector (exact/prefix/suffix)
- optional `editorPath`
- `textHash` using normalized SHA-256

Hashing rules:

1. UTF-8 encode
2. Unicode NFC normalize
3. normalize newlines to `\n`
4. SHA-256
5. base64url with `sha256-` prefix

---

## 6) Data Model Adaptation (Initial Schema -> Revised v0)

Use this mapping to evolve existing model names with minimal migration risk:

1. `users` -> `agents` (`type=person` by default for human accounts)
2. `provenance_records` -> `source_records` (protocol term), keep compatibility alias/view if needed
3. `span_attributions` -> `spans` with `sourceRefs[]` and selector bundle
4. keep `documents` as-is, add `canonicalHash`
5. evolve `reuse_events` to include status lifecycle:
   - `detected | notified | acknowledged | rejected`
6. add `activities` table for explicit event lineage (`create`, `paste`, `ai_generate`, etc.)
7. keep `signatures` optional and attachable to source/reuse/export records

Compatibility rule for v0 rollout:

- ingest old payload fields (`provenanceId`, `startOffset`, `endOffset`) and normalize to new span selector format on write.

---

## 7) API and Event Contracts

### 7.1 Core endpoints (cloud app)

- `POST /api/sources` create `SourceRecord`
- `GET /api/sources/:id` resolve source metadata
- `POST /api/spans/batch` upsert attributed spans for document save
- `POST /api/activities` log create/paste/import/edit events
- `POST /api/reuse-events` create downstream reuse records
- `POST /api/reuse-events/:id/notify` dispatch source notifications (policy-gated)

### 7.2 Reuse handshake profile (v0.1 behavior)

Destination app:

1. detect imported `sourceRefs`
2. create `ReuseEvent(status=detected)`
3. notify source endpoint if present and allowed
4. set status `notified` (or remain detected on policy failure)

Source side (or source inbox service):

1. verify signature if present
2. record downstream use
3. optionally return signed acknowledgement
4. destination may set status `acknowledged`

---

## 8) UX and Visualization Profile

Default rendering policy (presentation-layer, not protocol semantics):

- `human-authored`: red underline
- `ai-generated`: dashed underline + AI badge
- `external-quoted`: blue quote/accent style
- `ai-assisted`: dual indicator
- `unknown`: yellow highlight until resolved

Inspector panel for selected span:

- source classification
- attributed agent
- source URI/document
- trust state (signed/unsigned)
- downstream usage count and timeline link

---

## 9) Privacy, Trust, and Policy Controls

v0 minimum:

- unsigned claims allowed
- signed claims optional
- workspace policy controls source notifications

Recommended cloud controls:

- per-document privacy (`private|workspace|public`)
- per-source visibility controls
- redaction in public exports
- audit log for provenance edits and policy overrides

---

## 10) Delivery Plan

### Phase 1 (Weeks 1-4): Core attribution in cloud app + protocol package

1. implement CRP v0.0.1 core schema + validation in `@cliproot/protocol`
2. launch cloud auth/documents/editor with span/source persistence
3. support missing-provenance prompt and base visual rendering

Exit criteria:

- attributed documents can be created, saved, reloaded
- unknown provenance is explicitly captured

### Phase 2 (Weeks 5-8): Clipboard interop + reuse events

1. implement clipboard MIME read/write in `@cliproot/tiptap`
2. emit and persist `ReuseEvent` on import/paste
3. add notification dispatcher and source-side inbox/dashboard

Exit criteria:

- provenance survives round-trip copy/paste between compatible instances
- source can observe downstream reuse

### Phase 3 (Weeks 9-11): Public attribution graph and analytics

1. build source pages and where-used exploration
2. add derivation/reuse timeline views
3. add policy-aware public views

Exit criteria:

- clear network-effect demo for originators and reusers

### Phase 4 (Weeks 12-14): Optional trust/export profiles

1. add signature support for source and reuse receipts
2. add export adapters:
   - PROV-aligned JSON-LD
   - C2PA-style package profile (experimental)
   - RO-Crate profile (optional)

Exit criteria:

- export and verification paths exist without becoming hard dependencies for core use

---

## 11) Open Decisions to Resolve Early

1. default visibility for source records (`private` vs `public`)
2. notification policy (`opt-in`, `opt-out`, workspace-admin controlled)
3. strictness for unresolved provenance on paste (block vs warn)
4. AI metadata retention policy (store prompt hash or not)
5. public identity requirements for source attribution (anonymous allowed?)

---

## 12) Immediate Next Build Artifacts

1. `crp-v0.0.1` JSON schema package with TS types and validators
2. Tiptap extension that emits protocol-native span/activity/reuse payloads
3. Drizzle migrations aligned to `Agent/SourceRecord/Span/Activity/ReuseEvent`
4. cloud workflow demo:
   - authoring
   - paste/import with classification
   - source reuse dashboard

