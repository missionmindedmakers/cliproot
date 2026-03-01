# Provenance

Provenance is an open project to make document authorship and reuse traceable at the span level.

It combines:
- A protocol for transferring provenance data during copy/paste and import workflows.
- Optional rights policy and transfer permission metadata for cooperative enforcement.
- Agent-friendly interoperability profiles so LLMs/agents can consume and act on governed content without losing attribution context.
- A Notion-like proof-of-concept editor that preserves and visualizes attribution as content moves across documents.

## Mission

Help people trace information back to its source so they can:
- assess trust and accuracy,
- credit original authors,
- identify AI-generated contributions.

## Why This Matters

Today, copy/paste strips context. Attribution becomes optional, provenance gets lost, and downstream readers cannot reliably verify where claims came from.

This project treats attribution as core infrastructure, not an afterthought.

## What We Are Building

1. **Span-level provenance model**
Track origin and derivation of specific text spans, not just whole documents.

2. **Clipboard interop protocol (draft)**
Define a shared envelope for provenance transfer between cooperating apps, with a source↔destination handshake model and optional rights/permission controls.

3. **Agent-friendly protocol extensions**
Define transport/binding patterns for agent runtimes (including MCP/WebMCP-aligned flows) so structured tool calls carry provenance and rights context end-to-end.

4. **Cloud-first POC application**
Demonstrate the protocol in practice with identity, persistence, attribution UX, and reuse tracking.

5. **Path to standards alignment**
Design data structures that can map to C2PA concepts at export time while exploring bidirectional reuse acknowledgement.

## Current Status

This repository is currently in **protocol draft + POC planning** stage.

Available today:
- Draft protocol (`spx-prov` v0.1, v0.2, and v0.3 profiles)
- Data model exploration for provenance graph semantics
- Rights policy and transfer-permission analysis (`docs/transfer_permission.md`)
- Agent protocol research (`docs/agent_protocol_research.md`)
- WebMCP integration research (`docs/webmcp_research.md`)
- C2PA alignment research notes
- Product/architecture plan for a first public POC

Not yet included:
- App scaffold
- Running implementation
- Public API reference

## Repository Guide

- [Protocol Draft v3 (Current)](docs/protocol_draft_3.md)
- [Protocol Draft v2](docs/protocol_draft_2.md)
- [Protocol Draft v1](docs/protocol_draft_1.md)
- [Data Structuring](docs/data_structuring.md)
- [POC Plan](docs/draft_plan_1.md)
- [Rights and Transfer Permissions](docs/transfer_permission.md)
- [Plan v2: Rights Policy and Permissions](docs/draft_plan_2.md)
- [Agent Protocol Research](docs/agent_protocol_research.md)
- [WebMCP Research](docs/webmcp_research.md)
- [C2PA Research](docs/c2pa_research.md)

## Intended Audience

This README is primarily for:
- potential contributors,
- product/standards stakeholders evaluating adoption,
- teams interested in influencing protocol direction early.

## Near-Term Direction

- Validate and refine `v0.3` (agent-aware profile + WebMCP binding assumptions).
- Define conformance test vectors for clipboard + agent tool-call paths.
- Build the first cloud POC (editor + attribution graph + handshake/tool-call events).
- Prototype cooperative enforcement flows (allow, attribution-required, permission-required, private/no-copy).
- Prototype agent-facing policy enforcement (missing provenance rejection, attribution-preserving output checks, permission-gated actions).
- Validate the model through real workflows and interoperability experiments.
- Build credibility toward broader ecosystem participation (including future engagement with the Content Authenticity Initiative).
