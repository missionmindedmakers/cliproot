# Sample App Plan: Protocol-First Reference App

Date: 2026-03-02

## 1. Objective

Build a scoped OSS sample app that proves `spx-prov` protocol behavior end-to-end, not a production SaaS product.

Primary goal:
1. Make protocol behavior visible and testable during real editor interactions (copy/paste, policy checks, claims/receipts, attribution preservation, provenance graph updates).

Non-goals:
1. Full auth/multi-tenant product UX.
2. Billing, enterprise admin, or proprietary analytics.
3. Production-grade abuse/ops layers.

## 2. Product Shape (Recommended)

Use a single-page demo with two simulated app instances:
1. `Alice` view: source editor.
2. `Bob` view: destination editor.
3. Shared "Protocol Inspector" area with tabs:
   - `Clipboard`
   - `API Exchange`
   - `Policy Decisions`
   - `Provenance Graph`

This matches the intended story: copying from Alice and pasting into Bob triggers observable protocol exchange.

## 3. UX Flow to Demonstrate

## 3.1 Copy from Alice
1. Alice selects text in Tiptap (`@provenance/spx-prov-tiptap` marks).
2. App serializes:
   - `application/x-provenance+json` envelope.
   - `text/html` fallback with `data-prov-*`.
3. Clipboard tab shows exact payload bytes/JSON and parsed fields.

## 3.2 Paste into Bob
1. Bob parses MIME in protocol order (custom MIME, then HTML fallback).
2. Bob evaluates per-segment rights and grants.
3. Bob groups callbacks by `sourceInstance` and simulates:
   - discovery call (`/.well-known/provenance-interop`)
   - transfer claim POST (`/interop/transfer-claims`)
   - optional permission request POST (`/interop/permission-requests`)
4. Bob receives receipt statuses and applies insert behavior:
   - allow
   - allow with attribution
   - deny/pending with notice
5. Provenance graph updates appear immediately.

## 3.3 Permission-required branch
1. Paste denied due to missing grant.
2. User clicks `Request Permission`.
3. Source responds `pending_owner_approval` or accepted.
4. Retry paste path demonstrates idempotency (`claimId` replay safe).

## 4. Architecture Plan

## 4.1 Frontend
1. React app with two editor panels (`AliceEditor`, `BobEditor`).
2. Shared protocol/state store (Zustand or Redux).
3. Inspector components:
   - `ClipboardViewer`
   - `ApiExchangeLog`
   - `PolicyOutcomeTimeline`
   - `ProvenanceGraphView`

## 4.2 Demo backend (single process, dual-instance simulation)
1. `InstanceService(Alice)` and `InstanceService(Bob)` each with:
   - instance ID
   - signing key (`kid`)
   - well-known config
   - claim/receipt handlers
2. API endpoints mimic protocol contract from `protocol_draft_3.md`.
3. Deterministic mock latency/failure toggles to show retries and partial failures.

## 4.3 Core protocol modules (shared)
1. Envelope validation.
2. Canonicalization + `textHash` verification.
3. Policy evaluator (`open`, `attribution_required`, `permission_required`, `private_no_copy`).
4. Claim/receipt idempotency store by `claimId` and `toolCallId`.

## 5. Provenance Graph UI Recommendation

Implement graph rendering as a reusable client library component, separate from Tiptap:
1. Keep `@provenance/spx-prov-tiptap` focused on editor/clipboard concerns.
2. Add a new UI package (suggestion): `@provenance/spx-prov-react` with:
   - `ProvenanceGraphView`
   - `SegmentLineagePanel`
   - `PolicyBadge`
3. This avoids hard-coupling graph visualization to editor internals and supports non-editor consumers.

## 6. Storage Strategy: In-Memory vs Database

## 6.1 Tradeoff summary
In-memory:
1. Lowest setup friction.
2. Fastest for demos/tests.
3. Easy deterministic reset.
4. Less realistic for persistence/history queries.

Database (SQLite/Postgres):
1. More realistic lineage query behavior.
2. Better for long-history demos.
3. Higher setup and migration complexity.
4. More moving parts for contributors.

## 6.2 Recommendation

Use a repository interface with two adapters:
1. Default adapter: in-memory (no setup, ideal first-run DX).
2. Optional adapter: SQLite via Drizzle (single file DB, still lightweight).

Why this balance works:
1. Meets protocol proof goal immediately.
2. Preserves an upgrade path to realistic persistence without redesign.
3. Enables benchmark mode for "many spans/long history" claims.

## 7. Conformance-Focused Demo Scenarios

The sample app should ship preloaded scenarios aligned with v0.3 vectors:
1. Single-span `open` accepted.
2. `attribution_required` accepted with attribution rendering.
3. `permission_required` denied without grant.
4. `permission_required` accepted with active grant.
5. `private_no_copy` source block/notice replacement.
6. Multi-span mixed policies from multiple sources with one callback failure.
7. Replay same `claimId` (idempotent behavior visible in log).

## 8. Event Log Contract (What to show)

Each event row should include:
1. `timestamp`
2. `phase` (`copy`, `parse`, `policy_eval`, `discovery`, `claim_post`, `receipt`, `persist`)
3. `actor` (`alice-instance`, `bob-instance`, `ui`)
4. `bundleId` / `claimId` / `receiptId`
5. short status + reason code
6. expand/collapse raw JSON payload

This directly addresses the need to show "actual clipboard contents and API calls."

## 9. Implementation Phases

## Phase 1: Protocol-visible MVP
1. Dual editor UI (Alice/Bob).
2. Clipboard envelope generation/parsing.
3. Transfer claim/receipt simulation.
4. Event log + raw payload inspector.
5. In-memory graph persistence.

## Phase 2: Rights and grant flows
1. Permission request flow and pending approval states.
2. Grant manager panel (issue/revoke/expire).
3. Per-segment mixed-policy outcomes.

## Phase 3: Persistence and packaging
1. SQLite adapter behind repository interface.
2. Extract reusable graph component package.
3. Add conformance scenario loader and deterministic test fixtures.

## 10. Suggested Success Criteria

1. A new contributor can run the sample app in under 5 minutes.
2. Copy/paste action produces observable envelope, claim, receipt, and graph updates.
3. All selected v0.3 demo scenarios execute deterministically.
4. Policy outcomes and reason codes are visible and auditable in UI.
5. Same app code runs with in-memory and SQLite adapters without UI changes.

## 11. Final Recommendation

Proceed with the two-view Alice/Bob simulation and protocol inspector as the core sample app design.

For storage, start with in-memory by default but design immediately around a persistence interface and add SQLite as an optional mode in Phase 3. This keeps onboarding simple while still proving a credible real-world path.
