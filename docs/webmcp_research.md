# WebMCP Research and Integration Plan for `spx-prov`

Date: 2026-03-01

## 1. Executive Take

Your instinct is directionally right: WebMCP has real momentum and credible backing, but it is still pre-standard and operationally early.

What is solid now:
- Google is publicly running an early preview program (announced February 10, 2026).
- WebMCP is an official deliverable in the W3C WebML Community Group charter (charter start date September 25, 2025).
- Spec editors currently include both Google and Microsoft representatives.

What is still early:
- The published WebMCP spec is a W3C Community Group Draft (not standards-track).
- Core method algorithms in the spec are still marked TODO.
- Security/privacy sections in the draft spec are not yet filled in with normative detail.

Conclusion: treat WebMCP as a high-priority integration target, but use a compatibility profile approach in `spx-prov` so you can ship now without hard-coding unstable assumptions.

## 2. What WebMCP Is (Practically)

WebMCP is effectively “MCP-style tools in a browser page runtime”:
- Site exposes callable tools via `navigator.modelContext`.
- Tools are declared with name, description, JSON Schema input, execute callback, and optional annotations (`readOnlyHint`).
- Tools run in the same authenticated browser context as the SPA/page.

This is why “MCP for SPAs” is a useful shorthand:
- Reuses front-end JS logic.
- Keeps shared user/agent/page state.
- Avoids separate backend MCP server for many UX-driven workflows.

## 3. Momentum Signals (Primary Source Snapshot)

## 3.1 Governance and vendor support
- WebMCP appears in the WebML CG charter (Start Date: 2025-09-25) as a named API deliverable.
- Charter text explicitly describes WebMCP as human-in-the-loop and protocol-agnostic relative to MCP.
- Current draft editors include Google and Microsoft (from the draft report and Bikeshed source).

## 3.2 Chrome program signal
- Chrome developer blog announced WebMCP early preview on February 10, 2026.
- Google states preview access is via Early Preview Program (EPP), with docs/demos for participants.
- EPP page explicitly asks for feedback to shape APIs and support cross-browser standardization discussions.

## 3.3 Community velocity signal
- `webmachinelearning/webmcp` repo indicates meaningful activity and community traction.
- At crawl time (late Feb/early Mar 2026 snapshot in this analysis): roughly `1.8k` stars, `100` forks, `88` commits, `64` issues, `4` PRs.
- W3C minutes show recurring WebMCP agenda work (capability discovery, tool listing, elicitation, declarative API exploration, extension/CDP integration questions).

## 4. Maturity and Risk Assessment

## 4.1 Stable enough to prototype against
- API surface exists and is simple:
  - `navigator.modelContext.provideContext()`
  - `clearContext()`
  - `registerTool()`
  - `unregisterTool()`
  - `client.requestUserInteraction()`
- Fits existing SPA architecture patterns.

## 4.2 Not stable enough to hard-freeze
- Draft status explicitly non-standard.
- Multiple algorithm sections are TODO.
- Discovery model is still under discussion (declarative, manifest, service worker pathways).
- Security model details are acknowledged but not fully specified in normative spec text.

Practical implication: version your WebMCP integration profile independently in `spx-prov` and expect breaking changes.

## 5. How to Incorporate WebMCP into `spx-prov`

## 5.1 Add a WebMCP binding profile in `spx-prov` v0.3

Introduce:
- `binding.profile`: `webmcp-imperative-v1`
- `binding.minWebMcpCapabilities`:
  - `modelContext`
  - `toolAnnotations.readOnlyHint`
  - `requestUserInteraction`

This keeps your core protocol transport-agnostic while allowing a normative browser binding.

## 5.2 Tool contract requirements (normative for profile)

For each WebMCP tool that can read/transform/export governed content, require:

1. Input includes provenance envelope or pointer:
- `bundleId`
- `segments[]` (`segmentId`, `sourceEntityId`, `textHash`)
- `rightsSnapshot`
- `requestedAction`
- `targetSurface`

2. Output includes attribution-preserving provenance result:
- derived segment mapping (`source -> destination`)
- attribution payload plan
- policy outcome (`allow`, `allow_with_attribution`, deny/pending variants)
- optional `receiptId`

3. Tool metadata requirement:
- `annotations.readOnlyHint = true` only for genuinely non-mutating tools.

## 5.3 Rights-mode mapping at tool execution boundary

Map existing `spx-prov` policy modes directly:
- `open` -> allow unless local safety policy blocks.
- `attribution_required` -> require attribution channel in output.
- `permission_required` -> require active grant or trigger approval flow.
- `private_no_copy` -> deny transform/export unless explicit grant.

## 5.4 User interaction and consent

For WebMCP tools that may change rights state, publish content, or cross origin boundaries:
- Require `requestUserInteraction()` checkpoint before commit.
- Persist a `policy_decision` activity plus signed claim/receipt.

## 5.5 Discovery and context refresh for SPAs

Because SPA state changes frequently:
- Re-run `provideContext()` on route/state transitions that materially change tool affordances.
- Use `registerTool/unregisterTool` for incremental updates.
- Version tool names or descriptors when semantics change to prevent stale agent assumptions.

## 5.6 New claim types for browser tool events

Add optional claim types in `spx-prov`:
- `agent_tool_call_claim`
- `agent_tool_call_receipt`

Recommended status additions:
- `accepted_read_only`
- `accepted_with_attribution_required`
- `rejected_missing_provenance`
- `rejected_attribution_removed`
- `rejected_policy`

## 6. Suggested Implementation Sequence

1. `Phase A` (now): WebMCP imperative profile only.
- Implement `navigator.modelContext` integration in your POC editor.
- Start with 2-3 tools (`read_span`, `transform_span`, `insert_with_attribution`).

2. `Phase B`: Provenance-gated execution.
- Enforce `policyMode` per segment at tool boundary.
- Emit and verify signed receipts.

3. `Phase C`: Async and pending flows.
- Owner approval for `permission_required`.
- UI states for pending/denied/allowed-with-attribution.

4. `Phase D`: Declarative/service-worker alignment (optional).
- Track declarative/service-worker evolutions without coupling core protocol.

## 7. Credibility Plan Before EPP Application

You can increase credibility quickly by shipping public, testable artifacts tied to WebMCP’s current concerns.

## 7.1 Build and publish a focused demo

Publish a small repo/demo showing:
- SPA registers WebMCP tools via `navigator.modelContext`.
- Every tool call carries `spx-prov` input.
- Output includes provenance-preserving result and receipt.
- Explicit `requestUserInteraction()` for write/publish actions.

## 7.2 Add conformance and security evidence

Create a short “WebMCP + Provenance profile test suite”:
- missing provenance input -> reject
- attribution-required output with stripped attribution -> reject
- permission-required without grant -> pending/deny
- read-only tools correctly marked and audited

Publish threat model notes:
- cross-origin data leakage controls
- prompt injection handling at tool boundaries
- consent UX for sensitive actions

## 7.3 Contribute upstream in public

Target high-value WebMCP discussions with concrete proposals:
- provenance metadata conventions for tools,
- policy-aware tool annotations beyond `readOnlyHint`,
- interoperable audit fields for tool calls.

Even 1-2 accepted issues/PR-quality proposals materially strengthen EPP credibility.

## 7.4 EPP application packet checklist

Before applying, have:
- live demo URL + source repo,
- short architecture note (`WebMCP + spx-prov`),
- reproducible test script and results,
- clear feedback list for Chrome/WebMCP team (specific API pain points),
- implementation metrics (tool success rate, policy-block rate, latency impact).

## 8. Recommended `spx-prov` Spec Edits (Next Draft)

For `docs/protocol_draft_3.md`, add sections:
1. `WebMCP Binding Profile`
2. `Tool Provenance Input/Output Contract`
3. `Agent Tool Call Claim/Receipt`
4. `Consent and Elicitation Requirements`
5. `SPA Context Refresh Semantics`
6. `Conformance Tests: WebMCP Profile`

## 9. Source Notes

Primary sources used:
- WebMCP draft spec (W3C CG Draft Report): https://webmachinelearning.github.io/webmcp/
- WebMCP spec source (Bikeshed): https://raw.githubusercontent.com/webmachinelearning/webmcp/main/index.bs
- WebMCP explainer/proposal repo: https://github.com/webmachinelearning/webmcp
- WebMCP proposal details: https://raw.githubusercontent.com/webmachinelearning/webmcp/main/docs/proposal.md
- WebMCP service worker supplemental explainer: https://raw.githubusercontent.com/webmachinelearning/webmcp/main/docs/service-workers.md
- WebML CG charter (includes WebMCP scope and start date): https://webmachinelearning.github.io/charter/
- WebML CG minutes (WebMCP resolutions and direction):
  - https://www.w3.org/2025/08/14-webmachinelearning-minutes.html
  - https://www.w3.org/2025/09/18-webmachinelearning-minutes.html
  - https://www.w3.org/2025/10/02-webmachinelearning-minutes.html
- Chrome early preview announcement:
  - https://developer.chrome.com/blog/webmcp-epp
- Chrome EPP page:
  - https://developer.chrome.com/docs/ai/join-epp

Notes:
- Metrics like stars/issues/PRs are point-in-time and expected to change rapidly.
- Declarative API details are referenced by Chrome/EPP communications and W3C discussions, but the imperative API is currently the clearer implementation baseline in the published draft/spec sources.
