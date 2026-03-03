# Provenance

Provenance is an open project to make document authorship and reuse traceable at the span level.

It combines:
- A protocol for transferring provenance data during copy/paste and import workflows.
- Optional rights policy and transfer permission metadata for cooperative enforcement.
- Agent-friendly interoperability profiles so LLMs/agents can consume and act on governed content without losing attribution context.
- Public libraries/SDKs that implement protocol primitives and conformance behavior.

## Mission

Help people trace information back to its source so they can:
- assess trust and accuracy,
- credit original authors,
- identify AI-generated contributions.

## Why This Matters

Today, copy/paste strips context. Attribution becomes optional, provenance gets lost, and downstream readers cannot reliably verify where claims came from.

This project treats attribution as core infrastructure, not an afterthought.

## Repository Scope

This repository (`provenance`) is the **public protocol and libraries repo**.

It contains:
- Protocol drafts and supporting research.
- Public, Apache-2.0 libraries intended for third-party implementation and interoperability.
- A scoped open-source sample app/reference implementation for integration testing and onboarding.
- Conformance vectors and test guidance.

It does not contain the private cloud application implementation.

## What We Are Building

1. **Span-level provenance model**
Track origin and derivation of specific text spans, not just whole documents.

2. **Clipboard + handshake interop protocol (draft)**
Define a shared envelope for provenance transfer between cooperating apps, with a source/destination claim-receipt handshake and optional rights/permission controls.

3. **Agent-friendly protocol extensions**
Define transport/binding patterns for agent runtimes (including MCP/WebMCP-aligned flows) so structured tool calls carry provenance and rights context end-to-end.

4. **Public implementation libraries**
Ship protocol libraries that teams can adopt without depending on a hosted product.

5. **Path to standards alignment**
Design structures that can map to C2PA concepts at export time while exploring bidirectional reuse acknowledgement.

## Current Status

This repository is currently in **protocol draft + library planning/implementation** stage.

Status notes:
- `spx-prov` is a **draft protocol**, not a production standard yet.
- `v0.3` introduces an agent-aware profile and WebMCP binding assumptions that are **experimental and expected to evolve**.
- Public library architecture and API surface are defined in `docs/libraries_plan.md`.
- Recommended implementation path is a phased hybrid strategy (TS reference path first, Rust core promotion based on conformance/perf needs) as described in `docs/sample_app_alternatives.md`.

Available today:
- Draft protocol (`spx-prov` v0.1, v0.2, and v0.3 profiles)
- Data model exploration for provenance graph semantics
- Rights policy and transfer-permission analysis (`docs/transfer_permission.md`)
- Agent protocol research (`docs/agent_protocol_research.md`)
- WebMCP integration research (`docs/webmcp_research.md`)
- C2PA alignment research notes (`docs/c2pa_research.md`)
- Public libraries implementation plan (`docs/libraries_plan.md`)

Not yet included:
- Stable `1.0` protocol and finalized compatibility guarantees
- Published production SDK releases
- Formal conformance certification process

## Public Libraries Roadmap

Target package set (see `docs/libraries_plan.md`):

1. `@provenance/spx-prov-spec`
Protocol constants, schemas, and TypeScript types.

2. TypeScript reference implementation (`spx-prov` validation + policy evaluation primitives)
Initial canonical reference path for rapid protocol iteration and adoption.

3. `@provenance/spx-prov-tiptap`
Tiptap/ProseMirror interop package for attribution marks and clipboard behavior.

4. `@provenance/spx-prov-conformance` (recommended)
Shared vectors/harness for implementation verification.

5. `spx-prov-core` (Rust, phased)
Introduced in parallel for hot/correctness-critical paths; promoted to canonical when vectors stabilize and cross-language parity requirements justify the overhead.

6. `@provenance/spx-prov-node` and `spx_prov` (Python, phased)
Bindings over Rust core when/if Rust promotion is adopted.

## Sample App Scope

This repo may include a **scoped OSS sample app** as a reference implementation.

Include:
- Attribution-aware editor flow and inspector UX
- Clipboard provenance import/export (`application/x-provenance+json` + HTML fallback)
- Basic claim/receipt handshake simulation or callback endpoint
- Minimal provenance graph/lineage views for validation

Exclude (kept private/commercial):
- Multi-tenant enterprise controls (org roles, billing, quota systems)
- Proprietary analytics and growth loops
- Advanced enterprise connectors and operational tooling
- Proprietary risk/policy heuristics

## Repository Guide

- [Protocol Draft v3 (Current)](docs/protocol_draft_3.md)
- [Protocol Draft v2](docs/protocol_draft_2.md)
- [Protocol Draft v1](docs/protocol_draft_1.md)
- [Public Libraries Plan](docs/libraries_plan.md)
- [Sample App and Stack Alternatives](docs/sample_app_alternatives.md)
- [Sample App Plan (Protocol-First)](docs/sample_app_plans.md)
- [Data Structuring](docs/data_structuring.md)
- [POC Plan](docs/draft_plan_1.md)
- [Plan v2: Rights Policy and Permissions](docs/draft_plan_2.md)
- [Rights and Transfer Permissions](docs/transfer_permission.md)
- [Agent Protocol Research](docs/agent_protocol_research.md)
- [WebMCP Research](docs/webmcp_research.md)
- [C2PA Research](docs/c2pa_research.md)

## Intended Audience

This README is primarily for:
- potential contributors,
- product/standards stakeholders evaluating adoption,
- teams interested in implementing or validating protocol interoperability.

## Near-Term Direction

- Validate and refine `v0.3` (agent-aware profile + WebMCP binding assumptions).
- Publish language-neutral conformance vectors for clipboard + agent tool-call paths.
- Ship a TypeScript reference implementation for validation/policy logic first.
- Launch a scoped OSS sample app that exercises protocol, policy, and handshake flows end-to-end.
- Benchmark realistic long-history/high-span workloads to confirm true bottlenecks.
- Introduce Rust core modules selectively and promote to canonical only when justified by measured conformance/performance and cross-language needs.
- Add Node/Python Rust bindings as a phased follow-on when Rust core promotion is warranted.
- Build credibility toward broader ecosystem participation (including future engagement with the Content Authenticity Initiative).

## Execution Sequence (Libraries + Sample App)

This is the recommended order of implementation work:

1. **Lock v0.3 baseline artifacts**
   - Finalize/align schemas and required enums/status fields from `docs/protocol_draft_3.md`.
   - Document any open questions as protocol issues before coding.
2. **Publish conformance vectors**
   - Add language-neutral test vectors for clipboard, transfer claims/receipts, permission, and tool-call paths.
   - Define expected outcomes and reason codes for each vector.
3. **Ship `@provenance/spx-prov-spec`**
   - Publish constants, TypeScript types, and schema loading/validation helpers.
4. **Ship TypeScript reference implementation**
   - Implement canonicalization, `textHash`, envelope validation, and policy evaluation primitives.
5. **Build `@provenance/spx-prov-tiptap` integration**
   - Implement attribution marks plus clipboard MIME export/import behavior.
6. **Deliver sample app Phase 1 (protocol-visible MVP)**
   - Two simulated instance views (`Alice` + `Bob`) with copy/paste exchange.
   - Inspector tabs for clipboard payload, API exchange log, policy decisions, and provenance graph.
   - Default in-memory persistence for zero-setup onboarding.
7. **Deliver sample app Phase 2 (rights and grants)**
   - Add permission request and pending approval flows.
   - Add grant issue/revoke/expiry simulation and mixed-policy scenario handling.
8. **Deliver sample app Phase 3 (persistence and packaging)**
   - Add optional SQLite adapter behind a storage interface.
   - Extract reusable React provenance graph component(s) from sample app UX.
9. **Benchmark and decide Rust core promotion gate**
   - Benchmark high-history/high-span workloads and compare against target latency budgets.
   - Promote `spx-prov-core` only if conformance/performance/cross-language goals justify added complexity.
10. **If promoted: ship phased Rust bindings**
   - Add `@provenance/spx-prov-node` and `spx_prov` bindings with vector parity checks in CI.

## Project Tracking (GitHub Issues)

Yes, track this sequence in GitHub Issues so contributors can self-assign and execute scoped tasks.

Recommended workflow:

1. Create one issue per concrete deliverable (or tightly scoped sub-deliverable).
2. Group issues by milestones matching the sequence above (for example: `M1 v0.3 Baseline`, `M2 TS Libraries`, `M3 Sample App MVP`).
3. Use labels to make picking work easy (`protocol`, `libraries`, `sample-app`, `conformance`, `good first issue`).
4. Link issues to relevant docs/sections and expected acceptance criteria.

Issue templates:

- Keep existing templates (`bug`, `protocol change`, `question`).
- Add a **feature request/implementation** template for non-normative library and sample-app tasks.

## Glossary

### Protocol Terms (`spx-prov`)

- **Envelope**: transfer payload containing protocol/version metadata, source context, segments, policy defaults, and signature.
- **Bundle**: one logical transfer unit (`bundleId`) that may include multiple segments.
- **Segment**: an ordered text unit in a bundle with attribution, anchor, and rights data.
- **Span snapshot**: entity representing a text span at a specific state/time.
- **Text hash**: deterministic SHA-256 hash of canonicalized text, formatted as `sha256:<hex>`.
- **Anchor**: location metadata (offsets + context hashes) used to re-locate spans.
- **Source instance**: app instance where copied/referenced content originated.
- **Destination instance**: app instance receiving pasted/imported/transformed content.
- **Claim**: signed statement sent across systems (for transfer, permission, or tool calls).
- **Receipt**: response/attestation status for a claim.
- **Policy mode**: rights behavior (`open`, `attribution_required`, `permission_required`, `private_no_copy`).
- **Grant**: explicit permission for a grantee agent over scoped actions/segments/time window.
- **Policy outcome**: decision result (`allow`, `allow_with_attribution`, `deny_no_permission`, `deny_license_violation`, `pending_owner_approval`).
- **Binding profile**: versioned transport compatibility layer (for example `webmcp-imperative-v1`).
- **Context epoch**: monotonic context version identifier used to reject stale tool calls.

### Provenance Graph Terms

- **Entity**: content or policy object in provenance graph semantics.
- **Activity**: operation/event that used or generated entities (`paste`, `import`, `rewrite`, etc.).
- **Agent**: actor (`user`, `organization`, `model`, `instance`, `runtime`).
- **Edge**: typed relationship between nodes (`used`, `wasDerivedFrom`, `wasAttributedTo`, etc.).

### C2PA-Related Terms

- **Content credential / Manifest**: signed provenance package attached to or associated with an asset.
- **Claim**: signed statement set produced by a claim generator, containing assertions.
- **Assertion**: labeled metadata statement in a claim (for example actions or creative work metadata).
- **Ingredient**: source asset reference included in a new claim to represent derivation/composition.
- **Action assertion**: record of operations in claim history (`c2pa.created`, `c2pa.opened`, `c2pa.edited`, etc.).
- **Content binding**: cryptographic binding between claim and asset bytes/ranges.
- **Claim generator**: software/system that creates and signs claims.
- **Manifest store / repository**: location where one or more manifests for an asset are stored.

## Useful RFCs and Standards References

- RFC 2119: Key words for requirement levels (`MUST`, `SHOULD`, etc.)
  - https://www.rfc-editor.org/rfc/rfc2119
- RFC 8174: Updated interpretation for RFC 2119 key words
  - https://www.rfc-editor.org/rfc/rfc8174
- RFC 8259: JSON data format
  - https://www.rfc-editor.org/rfc/rfc8259
- RFC 3339: Date/time format in timestamps
  - https://www.rfc-editor.org/rfc/rfc3339
- RFC 3986: URI generic syntax
  - https://www.rfc-editor.org/rfc/rfc3986
- RFC 9562: UUIDs (includes UUIDv7)
  - https://www.rfc-editor.org/rfc/rfc9562
- RFC 8032: Ed25519 signature system
  - https://www.rfc-editor.org/rfc/rfc8032
- RFC 7517: JSON Web Key (JWK)
  - https://www.rfc-editor.org/rfc/rfc7517
- RFC 8785: JSON Canonicalization Scheme (JCS)
  - https://www.rfc-editor.org/rfc/rfc8785
- SPDX specification
  - https://spdx.github.io/spdx-spec/
- C2PA specification
  - https://spec.c2pa.org/
