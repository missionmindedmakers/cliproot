# Agent Protocol Research for Provenance-Aware Web Access

Date: 2026-03-01

## 1. Context and Goal

Based on the current project direction in `README.md` and `docs/protocol_draft_2.md`, the goal is to extend `spx-prov` so LLMs/agents can consume website content structurally and still respect span-level provenance and rights policy.

Your current protocol already has strong building blocks for this:
- signed transfer claims/receipts,
- per-segment rights and grants,
- discovery via `/.well-known/provenance-interop`.

The gap is web-agent interoperability: exposing machine-readable capabilities and requiring agents to carry provenance/rights state through tool calls.

## 2. Standards and Proposals Reviewed

## 2.1 Schema.org + JSON-LD (foundational)

What it is:
- Schema.org provides shared vocabularies for entities, relationships, and actions (including `potentialAction`, `Action`, `EntryPoint`).
- JSON-LD 1.1 is the W3C Recommendation serialization for linked data in JSON.

Why it matters for agents:
- It is the most established machine-readable layer already present on many sites.
- It can describe both content and affordances (for example action endpoints and inputs).

Provenance relevance:
- You can represent attribution/licensing metadata in structured form and bind it to specific entities/spans.
- It is a practical substrate for `spx-prov` discovery and payload pointers.

Maturity:
- High.

## 2.2 NLWeb (Microsoft)

What it is:
- Open project announced by Microsoft on 2025-05-19 for adding natural-language interfaces to sites.
- Explicitly positions each NLWeb instance as an MCP server.

How it works (current implementation signals):
- Leverages existing structured data (Schema.org, RSS, etc.).
- Exposes site interaction through `/ask` and `/mcp` endpoints.
- MCP-oriented interface allows agents to use tool-like access instead of raw DOM workflows.

Provenance relevance:
- NLWeb is server-side and structured, so it is a good place to require `spx-prov` metadata in tool inputs/outputs.
- Could be the cleanest first integration path because your protocol already has signed callbacks and receipts.

Maturity:
- Medium (real implementation exists, but still early ecosystem stage).

## 2.3 LLM-LD

What it is:
- New standard effort (v1.0 on site) focused on AI-readable websites.
- Promotes a layered model: Schema.org baseline, entity graph layer, and `/.well-known/llm-index.json` entrypoint.
- Includes a discovery network concept (LLM Disco).

Provenance relevance:
- The `llm-index.json` pattern is useful for discoverability and could carry pointers to provenance policy endpoints.
- Layered architecture maps well to your bundle/segment model.

Caveat:
- This appears very new and currently vendor-led (Capxel launch announced 2026-02-25).
- I could not retrieve the full `/spec/llm-ld-v1` page content directly via this crawler, so this assessment uses the homepage architecture and launch materials.

Maturity:
- Low to medium (promising, early).

## 2.4 WebMCP (Web Machine Learning Community Group)

What it is:
- A browser-native API proposal/spec for exposing tools directly from web pages to agents.
- Current API surface centers on `navigator.modelContext` with `provideContext`, `registerTool`, `unregisterTool`, and user-interaction hooks.

Current status:
- Published as a W3C Community Group Draft report on 2026-02-27.
- Explicitly not a W3C Recommendation/Standard yet.
- Spec still has TODO algorithm sections, so behavior details can change.

Provenance relevance:
- Strong fit for “no DOM parsing” and explicit tool contracts.
- Best place to enforce provenance on action boundaries: every tool call can require provenance context and return signed receipts.

Maturity:
- Low to medium (important direction, early draft).

## 2.5 llms.txt

What it is:
- Proposal (published 2024-09-03) for a root `/llms.txt` markdown file to help LLMs find curated content.

Provenance relevance:
- Good for discovery and policy hints (for example, where provenance endpoints live).
- Not a transactional/action protocol; by itself it cannot enforce provenance propagation.

Maturity:
- Medium as a lightweight convention, low as a formal standards-track spec.

## 2.6 MCP (Model Context Protocol)

What it is:
- General agent-tool protocol for hosts/clients/servers over JSON-RPC.
- Latest spec URL currently resolves to revision `2025-11-25`.

Provenance relevance:
- MCP is already central to NLWeb and referenced by WebMCP.
- Tool schemas are a natural place to require provenance input/output contracts and consent flows.

Maturity:
- High (broad adoption trajectory and formalized spec revisions).

## 3. Comparison for `spx-prov` Integration

| Option | Main layer | Avoids DOM parsing | Discovery built-in | Write/action support | Governance maturity | `spx-prov` integration difficulty |
| --- | --- | --- | --- | --- | --- | --- |
| Schema.org + JSON-LD | content semantics | Partial (data only) | Indirect | Limited by itself | High | Low |
| NLWeb | server-side NL + MCP | Yes | Moderate | Yes | Medium | Low-Medium |
| LLM-LD | site discovery + semantic layer | Yes (goal) | Strong (`llm-index`) | Not clearly transactional yet | Low-Medium | Medium |
| WebMCP | browser runtime API | Yes | Limited today | Yes (tool calls) | Low-Medium | Medium |
| llms.txt | inference-time guide | Partial | Strong (simple path) | No | Medium (informal) | Low |
| MCP | generic tool protocol | Yes | Registry/ecosystem level | Yes | High | Low |

## 4. Implications for a Provenance-Respecting Extension

## 4.1 What to require regardless of transport

A transport-agnostic policy for agents should require:
1. Provenance-carrying inputs on any read/transform/paste tool call.
2. Rights-aware decisioning using per-segment policy, not document-level shortcuts.
3. Signed receipts for material actions (transform, summarize, redistribute, publish).
4. Attribution-preserving outputs (or explicit denial states with reason codes).

## 4.2 Proposed `spx-prov` v0.3 extension shape

### A) Discovery additions

Extend `/.well-known/provenance-interop` with agent capability advertisement:

- `agentProtocols`: e.g., `mcp`, `nlweb`, `webmcp`, `llm-ld`, `llms-txt`.
- `provenanceRequiredForActions`: list of actions requiring provenance bundle.
- `policyDecisionEndpoint`: standardized decision callback for tool calls.

### B) Tool contract requirements

For MCP/WebMCP/NLWeb tool definitions, require:
- `provenanceInputSchema` (required fields like `bundleId`, `segmentIds`, `textHash`, rights snapshot).
- `provenanceOutputSchema` (derived segment mapping + attribution plan + receipt reference).
- `readOnlyHint` and risk annotations aligned with your policy modes.

### C) New claim/receipt semantics

Add claim types oriented to agent interactions:
- `agent_tool_call_claim`
- `agent_tool_call_receipt`

Add status codes for policy-visible outcomes:
- `accepted_read_only`
- `accepted_with_attribution_required`
- `rejected_missing_provenance`
- `rejected_attribution_removed`
- `rejected_policy`

### D) Alignment with current rights modes

Map your existing `policyMode` directly into agent tool decisions:
- `open` -> normal allow,
- `attribution_required` -> allow only with guaranteed attribution channel,
- `permission_required` -> require active grant or pending owner approval,
- `private_no_copy` -> deny export/transform unless explicitly granted.

## 5. Recommended Path (Pragmatic)

1. Keep Schema.org/JSON-LD as baseline semantic substrate.
2. Implement MCP-first `spx-prov` tool contracts (works with NLWeb immediately).
3. Add WebMCP bindings as the browser-side profile once API stabilizes.
4. Add lightweight discovery hints via `llms.txt` and optional LLM-LD-compatible `/.well-known/llm-index.json` pointers.
5. Treat LLM-LD as an optional discovery layer until governance/spec stability improves.

## 6. Notes and Risks

- WebMCP is promising but still early draft; avoid hard-coding behavior that depends on unfinished algorithm sections.
- LLM-LD appears early and fast-moving; use it as an optional compatibility profile, not a hard dependency.
- NLWeb + MCP is currently the most concrete bridge from structured site data to agent tooling while preserving server-side policy control.

## 7. Sources

- Project context: `README.md`, `docs/protocol_draft_2.md` (local repository).
- Microsoft NLWeb announcement (2025-05-19):
  - https://news.microsoft.com/source/features/company-news/introducing-nlweb-bringing-conversational-interfaces-directly-to-the-web/
- NLWeb reference implementation:
  - https://github.com/nlweb-ai/NLWeb
  - https://raw.githubusercontent.com/nlweb-ai/NLWeb/main/docs/nlweb-rest-api.md
- Schema.org:
  - https://schema.org/
  - https://schema.org/docs/actions.html
  - https://schema.org/EntryPoint
- JSON-LD 1.1 (W3C Recommendation):
  - https://www.w3.org/TR/json-ld11/
- WebMCP (W3C CG draft + proposal artifacts):
  - https://webmachinelearning.github.io/webmcp/
  - https://raw.githubusercontent.com/webmachinelearning/webmcp/main/index.bs
  - https://raw.githubusercontent.com/webmachinelearning/webmcp/main/docs/proposal.md
  - https://lists.w3.org/Archives/Public/public-webmachinelearning/2025Sep/0007.html
- MCP specification (latest currently 2025-11-25):
  - https://modelcontextprotocol.io/specification/latest
- LLM-LD:
  - https://llmld.org/
  - https://llmdisco.com/
  - https://www.prnewswire.com/news-releases/capxel-launches-llm-ld-the-first-open-standard-for-making-websites-readable-by-ai-agents-302697021.html
- llms.txt proposal:
  - https://llmstxt.org/index.html
- Web-agent declarative affordance research (VOIX paper, from provided link):
  - https://arxiv.org/html/2511.11287v1
