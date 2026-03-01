# Span Provenance Interop Protocol Draft v0.3

## 1. Purpose
This document defines the `spx-prov` v0.3 profile for span-level provenance exchange between cooperating apps and agent runtimes.

It extends v0.2 with:
1. Agent protocol binding support (MCP/WebMCP profile model).
2. A normative WebMCP browser binding profile (`webmcp-imperative-v1`).
3. Tool-level provenance input/output contract requirements.
4. Agent tool call claims/receipts and policy-visible status codes.
5. Consent/elicitation and SPA context refresh semantics.

It assumes:
1. Typed-node/typed-edge provenance graph model.
2. Span addressing with offsets plus context anchors.
3. Clipboard transport via custom MIME plus HTML `data-*` fallback.
4. Source/destination handshake with signed claims and receipts.
5. Instance-signed protocol messages (Ed25519 in v0.3 profile).
6. WebMCP is an early-stage binding; this spec treats binding profiles as versioned compatibility layers.

## 2. Protocol Versioning and Compatibility
- Protocol identifier: `spx-prov`.
- Version in this draft: `0.3`.
- All v0.3 messages MUST include `protocol: "spx-prov"` and `version: "0.3"`.
- Receivers MUST ignore unknown optional fields.
- v0.3 receivers SHOULD support ingest of v0.2 envelopes when feasible.
- Breaking changes to core fields MUST increment major version.
- Binding profile changes MAY be released with profile version bumps (for example `webmcp-imperative-v2`) without changing core major version.

## 3. Interop Roles
- `source instance`: app instance where copied or referenced content originated.
- `destination instance`: app instance receiving pasted/imported/transformed content.
- `agent`: user, org, model, or app instance.
- `agent runtime`: host environment invoking tools (for example browser model runtime).
- `tool host`: component registering and executing tool handlers.
- `owner agent`: rights owner for a governed segment/entity.
- `verifier`: service/component validating signatures and payload rules.

## 4. Canonical Identifiers
All IDs are opaque, globally unique strings (UUIDv7 recommended):
- `entityId`
- `activityId`
- `agentId`
- `claimId`
- `receiptId`
- `bundleId`
- `grantId`
- `policyId`
- `permissionRequestId`
- `toolCallId`
- `contextEpochId`

## 5. Core Node and Edge Semantics

### 5.1 Node kinds
- `prov_entity.kind`: `span_snapshot | document_version | source_artifact | policy | grant`
- `prov_activity.kind`: `paste | import | rewrite | summarize | merge | split | grant_issued | grant_revoked | grant_requested | policy_decision | agent_tool_call | agent_tool_result | agent_tool_publish`
- `prov_agent.kind`: `user | organization | model | instance | runtime`
- `prov_claim.claim_type`: `transfer_claim | transfer_receipt | permission_request | permission_decision | agent_tool_call_claim | agent_tool_call_receipt`

### 5.2 Edge types
- `used` (`activity -> entity`)
- `wasGeneratedBy` (`entity -> activity`)
- `wasDerivedFrom` (`entity -> entity`)
- `wasAttributedTo` (`entity -> agent`)
- `wasAssociatedWith` (`activity -> agent`)
- `attests` (`claim -> activity|entity`)
- `contains` (`document_version -> span_snapshot`)
- `governs` (`policy -> entity`)
- `grantsAccess` (`grant -> agent`)
- `appliesTo` (`grant -> entity`)
- `revokes` (`activity -> grant`)

Receivers MUST reject edges whose node-kind pairs do not match allowed mappings.

## 6. Span Addressing and Fingerprints
Each `span_snapshot` entity MUST include:
- `anchor.start.offset`
- `anchor.start.leftContextHash`
- `anchor.start.rightContextHash`
- `anchor.end.offset`
- `anchor.end.leftContextHash`
- `anchor.end.rightContextHash`
- `textHash`

Canonicalization v0.3:
1. Normalize UTF-8.
2. Normalize newlines to `\n`.
3. Do not trim characters (whitespace is meaningful).
4. Hash with SHA-256 and prefix `sha256:`.

## 7. Rights Policy Model

### 7.1 Policy modes
`rights.policyMode`:
- `open`
- `attribution_required`
- `permission_required`
- `private_no_copy`

### 7.2 Rights schema
Rights MAY be set at bundle default and/or segment level. Segment-level rights override bundle defaults.

```json
{
  "rights": {
    "policyMode": "attribution_required",
    "license": {
      "spdxExpression": "CC-BY-4.0",
      "canonicalUrl": "https://creativecommons.org/licenses/by/4.0/",
      "humanLabel": "Creative Commons Attribution 4.0",
      "customLicenseRef": null
    },
    "attribution": {
      "required": true,
      "preferredText": "Jane Doe, 2026",
      "preferredUrl": "https://example.com/post/123"
    },
    "proliferation": {
      "allowRedistribution": true,
      "allowDerivatives": true,
      "allowCommercialUse": true
    }
  }
}
```

Rules:
1. `license.spdxExpression` SHOULD be used when license is SPDX-representable.
2. Proprietary terms MAY use `customLicenseRef` (for example, `LicenseRef-Internal-EULA`).
3. `policyMode` MUST be explicit even when derivable from license.

### 7.3 Access control and grants
`accessControl` supports recipient-specific permissions:

```json
{
  "accessControl": {
    "ownerAgentId": "agent_user_alice",
    "defaultDecision": "deny",
    "grants": [
      {
        "grantId": "01J...",
        "granteeAgentId": "agent_user_bob",
        "scope": ["read", "quote", "paste_with_attribution"],
        "segmentIds": ["seg_1"],
        "issuedAt": "2026-03-01T14:00:00Z",
        "expiresAt": "2026-06-01T00:00:00Z",
        "status": "active"
      }
    ]
  }
}
```

Grant `status` values:
- `active`
- `revoked`
- `expired`
- `pending`

### 7.4 Copy control hints
`copyControl` indicates preferred source behavior when action is denied:

```json
{
  "copyControl": {
    "onDenied": "replace_with_notice|block_copy|allow_but_mark_unlicensed",
    "noticeTemplate": "Copyright (c) 2026 Alice. Reuse requires permission: https://example.com/request-access",
    "requestAccessUrl": "https://example.com/request-access"
  }
}
```

## 8. Envelope and Transport Profiles
Destination SHOULD parse in this order:
1. `application/x-provenance+json`
2. `text/html` with `data-prov-*` and policy hints
3. user attribution/policy prompt fallback

### 8.1 Clipboard envelope shape
```json
{
  "protocol": "spx-prov",
  "version": "0.3",
  "bundleId": "01J...",
  "sourceInstance": "https://writer.example",
  "sourceDocument": {
    "documentId": "doc_src_123",
    "documentVersionId": "docv_src_45"
  },
  "policyDefaults": {
    "rights": {
      "policyMode": "attribution_required",
      "license": {"spdxExpression": "CC-BY-4.0"}
    },
    "copyControl": {"onDenied": "replace_with_notice"}
  },
  "accessControl": {
    "ownerAgentId": "agent_user_alice",
    "defaultDecision": "deny",
    "grants": []
  },
  "segments": [
    {
      "segmentId": "seg_1",
      "order": 0,
      "text": "Quoted sentence A.",
      "entityId": "ent_span_A1",
      "rights": {
        "policyMode": "permission_required",
        "license": {"spdxExpression": "LicenseRef-Internal-EULA"},
        "attribution": {"required": true}
      },
      "attribution": {
        "primaryAgentId": "agent_user_alice",
        "sourceArtifactUrl": "https://writer.example/post/abc",
        "classification": "quoted"
      },
      "anchor": {
        "start": {"offset": 120, "leftContextHash": "sha256:...", "rightContextHash": "sha256:..."},
        "end": {"offset": 138, "leftContextHash": "sha256:...", "rightContextHash": "sha256:..."}
      },
      "textHash": "sha256:..."
    }
  ],
  "signature": {
    "alg": "Ed25519",
    "kid": "did:key:z...#instance-key-1",
    "sig": "base64..."
  }
}
```

### 8.2 Binding profile declaration
Agent/tool payloads SHOULD include:

```json
{
  "binding": {
    "protocol": "webmcp",
    "profile": "webmcp-imperative-v1",
    "capabilities": ["modelContext", "toolAnnotations.readOnlyHint", "requestUserInteraction"]
  }
}
```

## 9. Multi-Span and Multi-Origin Behavior
Each segment is independently attributable and independently governed.

Rules:
1. Destination MUST preserve segment order.
2. Destination MUST create one `paste` or `agent_tool_call` activity per operation.
3. Destination MUST create one generated `span_snapshot` per resulting segment.
4. Destination MUST apply per-segment rights evaluation, not just bundle-level evaluation.
5. Destination MUST group callbacks by `sourceInstance`.
6. If one source callback fails, other source callbacks MUST still proceed.
7. Mixed-policy bundles MUST produce per-segment status visibility.

## 10. Policy Evaluation Profile

### 10.1 Required evaluation inputs
Destination and source evaluators SHOULD consider:
- requesting `agentId`
- requested action (`read`, `quote`, `paste`, `transform`, `redistribute`, `publish`)
- destination surface (`private_doc`, `team_doc`, `public_web`, `agent_runtime`)
- segment `rights` and `accessControl` state
- active grants and expiry
- binding profile and tool metadata (`readOnlyHint`)

### 10.2 Policy outcomes
Allowed outcomes:
- `allow`
- `allow_with_attribution`
- `deny_no_permission`
- `deny_license_violation`
- `pending_owner_approval`

### 10.3 Mode semantics
1. `open`: action SHOULD be allowed unless local safety policy blocks.
2. `attribution_required`: action MAY proceed only if attribution payload can be preserved or supplied.
3. `permission_required`: action requires active matching grant; else deny or pending approval flow.
4. `private_no_copy`: source SHOULD block copy or replace payload; destination SHOULD reject ungranted transfer.

## 11. Discovery and Handshake API Contract

### 11.1 Discovery
`GET /.well-known/provenance-interop`

Response:
```json
{
  "protocol": "spx-prov",
  "version": "0.3",
  "transferClaimsEndpoint": "https://source.example/interop/transfer-claims",
  "permissionRequestsEndpoint": "https://source.example/interop/permission-requests",
  "agentToolClaimsEndpoint": "https://source.example/interop/agent-tool-claims",
  "policyDecisionEndpoint": "https://source.example/interop/policy-decisions",
  "jwksUri": "https://source.example/.well-known/jwks.json",
  "supportsSignedReceipt": true,
  "supportsRightsPolicy": true,
  "agentProtocols": ["mcp", "webmcp", "nlweb"],
  "supportedBindingProfiles": ["webmcp-imperative-v1"],
  "provenanceRequiredForActions": ["transform", "redistribute", "publish"]
}
```

### 11.2 Transfer claim endpoint
- `POST /interop/transfer-claims`
- Idempotency key SHOULD be `claimId`.

Request and response shapes remain compatible with v0.2, with `version: "0.3"`.

Receipt `status` values (v0.3 baseline):
- `accepted`
- `accepted_with_attribution_required`
- `accepted_unsigned`
- `rejected_invalid_signature`
- `rejected_unknown_source_entity`
- `rejected_policy`
- `rejected_no_permission`
- `rejected_license_violation`
- `pending_async`
- `pending_owner_approval`

### 11.3 Permission request endpoint (optional)
- `POST /interop/permission-requests`
- Used when destination/user requests grant creation for denied or pending transfers.

### 11.4 Agent tool claim endpoint (new)
- `POST /interop/agent-tool-claims`
- Used for provenance-aware tool operations in MCP/WebMCP bindings.
- Idempotency key SHOULD be `toolCallId`.

## 12. WebMCP Binding Profile (`webmcp-imperative-v1`)
This profile defines normative behavior for browser-native tool exposure using the WebMCP imperative API surface.

### 12.1 Minimum capability assumptions
Implementations claiming `webmcp-imperative-v1` MUST support:
- `navigator.modelContext.provideContext()`
- `navigator.modelContext.clearContext()`
- `navigator.modelContext.registerTool()`
- `navigator.modelContext.unregisterTool()`
- `requestUserInteraction` (or equivalent user interaction request facility exposed by the runtime)

### 12.2 Profile goals
1. No DOM scraping requirement for agent interaction paths.
2. Tool boundary as provenance/policy enforcement boundary.
3. Human checkpoint for sensitive actions.

### 12.3 Compatibility expectation
Because WebMCP is early-stage, profile-specific behavior MAY evolve; implementers SHOULD gate behavior by explicit profile version and preserve backward compatibility shims where feasible.

## 13. Tool Provenance Input/Output Contract

### 13.1 Required tool input fields
For tools that read, transform, export, or publish governed content, input MUST include:
- `toolCallId`
- `requestedAction`
- `targetSurface`
- `bundleId` (or resolvable `provenanceRef`)
- `segments[]` with `segmentId`, `sourceEntityId`, `textHash`
- `rightsSnapshot` (resolved per segment at call time)
- caller identity context (`agentId` or pseudonymous equivalent)

Example tool input:
```json
{
  "protocol": "spx-prov",
  "version": "0.3",
  "binding": {"protocol": "webmcp", "profile": "webmcp-imperative-v1"},
  "toolCallId": "01J...",
  "requestedAction": "transform",
  "targetSurface": "team_doc",
  "provenance": {
    "bundleId": "01J...",
    "segments": [
      {
        "segmentId": "seg_1",
        "sourceEntityId": "ent_a1",
        "textHash": "sha256:..."
      }
    ],
    "rightsSnapshot": [
      {
        "segmentId": "seg_1",
        "policyMode": "attribution_required"
      }
    ]
  },
  "actor": {
    "agentId": "agent_user_42"
  }
}
```

### 13.2 Required tool output fields
Tool output MUST include:
- `toolCallId`
- `policyOutcome`
- `derivedSegments[]` mapping source->destination
- `attributionPlan` when applicable
- `receiptRef` when receipt issued synchronously

Example tool output:
```json
{
  "protocol": "spx-prov",
  "version": "0.3",
  "toolCallId": "01J...",
  "policyOutcome": "allow_with_attribution",
  "derivedSegments": [
    {
      "sourceSegmentId": "seg_1",
      "destinationEntityId": "ent_d9",
      "textHash": "sha256:..."
    }
  ],
  "attributionPlan": {
    "mode": "inline_source_link",
    "payload": {
      "preferredText": "Jane Doe, 2026",
      "preferredUrl": "https://example.com/post/123"
    }
  },
  "receiptRef": {
    "receiptId": "01J..."
  }
}
```

### 13.3 Tool metadata and mutability
If a tool is declared with `readOnlyHint=true`, the tool MUST NOT:
- create derived entities,
- publish or redistribute content,
- mutate policy/grant state.

Implementations SHOULD reject calls where observed behavior conflicts with declared read-only metadata.

## 14. Agent Tool Call Claim and Receipt (New)

### 14.1 Claim payload shape
```json
{
  "protocol": "spx-prov",
  "version": "0.3",
  "claimId": "01J...",
  "claimType": "agent_tool_call_claim",
  "toolCallId": "01J...",
  "binding": {"protocol": "webmcp", "profile": "webmcp-imperative-v1"},
  "tool": {
    "name": "transform_span",
    "readOnlyHint": false
  },
  "requestedAction": "transform",
  "targetSurface": "team_doc",
  "segments": [
    {
      "segmentId": "seg_1",
      "sourceEntityId": "ent_a1",
      "textHash": "sha256:..."
    }
  ],
  "signature": {
    "alg": "Ed25519",
    "kid": "did:key:z...#instance-key-1",
    "sig": "base64..."
  }
}
```

### 14.2 Receipt statuses
Agent tool receipts MAY return:
- `accepted_read_only`
- `accepted_with_attribution_required`
- `rejected_missing_provenance`
- `rejected_attribution_removed`
- `rejected_policy`

Receipts SHOULD include reason codes sufficient for audit and user messaging.

## 15. Consent and Elicitation Requirements
For WebMCP-bound tools, implementations MUST request explicit user interaction before commit when any of the following is true:
1. `requestedAction` is `publish` or `redistribute`.
2. Tool writes to a new destination surface or audience.
3. `policyMode` is `permission_required` and no active grant is present.
4. Cross-origin transfer is involved.
5. Tool attempts to downgrade attribution visibility.

Implementations SHOULD persist:
- one `policy_decision` activity,
- one claim/receipt pair (sync or async),
- user-facing decision rationale.

## 16. SPA Context Refresh Semantics
Implementations using `webmcp-imperative-v1` MUST keep model context synchronized with app state.

### 16.1 Required refresh triggers
Re-run `provideContext()` when:
1. route/document changes,
2. signed-in identity changes,
3. active grants/policies for current segments change,
4. tool set changes,
5. destination surface or audience changes.

### 16.2 Tool registry refresh
- `registerTool()` SHOULD be used for newly available tools.
- `unregisterTool()` SHOULD be used when a tool becomes unavailable or policy-restricted.
- Tool descriptors SHOULD be versioned when semantics change to avoid stale agent assumptions.

### 16.3 Context epoch tracking
Tool calls SHOULD carry a `contextEpochId`. Calls with stale epoch IDs MAY be rejected with retriable status.

## 17. Source and Destination Persistence Rules
On successful processing, destination MUST persist:
1. one `prov_activity` (`paste` or `agent_tool_call`),
2. one generated `span_snapshot` per resulting segment,
3. standard provenance edges (`used`, `wasGeneratedBy`, `wasDerivedFrom`, `wasAttributedTo`),
4. one transfer or tool claim per callback group,
5. one receipt when response received.

When policy fields exist, destination SHOULD also persist:
1. policy state associated with each segment/entity,
2. grant references used for authorization decision,
3. policy decision outcome with reason code.

Source SHOULD persist:
1. grant lifecycle activities (`grant_issued`, `grant_revoked`, `grant_requested`),
2. decision logs for denied/pending transfers,
3. linkage between decision and resulting receipt status.

## 18. Validation Rules
Receiver MUST validate:
1. protocol/version compatibility,
2. signature against sender key,
3. `textHash` consistency for provided text,
4. no duplicate `segmentId` in a bundle,
5. contiguous segment ordering by `order`,
6. callback payload source/destination consistency,
7. policy enum values (`policyMode`, `onDenied`, status fields),
8. grant validity window when grants are provided (`issuedAt <= now < expiresAt`, if `expiresAt` exists),
9. required provenance input fields for governed tool calls,
10. `readOnlyHint` consistency for tools declaring read-only behavior.

Receiver SHOULD validate:
1. SPDX expression syntax when `spdxExpression` is present,
2. `customLicenseRef` presence when SPDX is not applicable,
3. `contextEpochId` freshness for WebMCP tool calls.

## 19. Retry, Idempotency, and Pending Approval
- Destinations SHOULD retry failed callbacks with exponential backoff.
- Sources MUST treat duplicate `claimId` as idempotent replay.
- Tool handlers MUST treat duplicate `toolCallId` as idempotent replay.
- `pending_async` and `pending_owner_approval` responses SHOULD include a poll or webhook mechanism.
- Destinations SHOULD surface pending state per source and per segment where relevant.

## 20. Security Profile (v0.3)
- Signature algorithm: Ed25519.
- Key distribution: JWKS or DID key documents.
- Key rotation via `kid`.
- Required audit fields: `createdAt`, `senderInstance`, `kid`, `claimId` or `toolCallId`, payload hash.
- Policy enforcement is best-effort among cooperating systems and is not universal copy prevention.
- Implementations SHOULD harden tool boundaries against prompt injection and cross-origin exfiltration.

## 21. Privacy Profile
- Implementers SHOULD minimize personal data in grant and decision payloads.
- Pseudonymous `agentId` is acceptable when identity disclosure is not required.
- Retention policies SHOULD apply to receipts, decisions, and grant-request metadata.
- Context payloads in agent runtimes SHOULD avoid unrelated user data.

## 22. Standards Mapping Notes
- License identifiers: SPDX expressions and license references.
- Policy model bridge: optional mapping to ODRL (Permission/Prohibition/Duty semantics).
- Export compatibility: C2PA mapping remains export-time; include rights metadata in exporter assertions where applicable.
- Agent transport mapping: MCP/WebMCP bindings carry `spx-prov` payloads without changing core graph semantics.

## 23. Interop Conformance Levels
- Level 1 (`import-only`): parse bundle and preserve attribution.
- Level 2 (`callback`): send transfer claims and record receipts.
- Level 3 (`signed mutual attestation`): enforce signed receipts and strict validation.
- Level 4 (`rights-aware enforcement`): evaluate `policyMode`, grants, and copy-control outcomes.
- Level 5 (`agent-aware tool governance`): enforce tool provenance contracts and policy decisions across MCP/WebMCP bindings.

## 24. Minimal Interop Test Vectors (v0.3)
1. Single span, `open`, signed, accepted.
2. `attribution_required` span accepted with attribution requirement.
3. `permission_required` span with active grant accepted.
4. `permission_required` span without grant rejected (`rejected_no_permission`).
5. `private_no_copy` source behavior: block copy or replace with notice.
6. Three spans from two sources with mixed policies, one source unreachable (partial pending).
7. Missing provenance payload with user-supplied attribution fallback and low-confidence policy handling.
8. Replay with same `claimId` (idempotent response).
9. Grant revoked after copy and before paste (destination rejection on re-evaluation).
10. WebMCP tool call missing provenance input -> `rejected_missing_provenance`.
11. WebMCP tool output strips required attribution -> `rejected_attribution_removed`.
12. `permission_required` tool call without active grant -> `pending_owner_approval` or deny.
13. Tool declared `readOnlyHint=true` attempts mutation -> reject and audit.
14. SPA route change without context refresh -> stale `contextEpochId` rejected and retried.

## 25. Conformance Tests: WebMCP Profile
An implementation claiming `webmcp-imperative-v1` MUST pass:
1. Context publication: `provideContext()` called and includes current tool/policy state.
2. Tool registration lifecycle: `registerTool()` and `unregisterTool()` reflect policy and route changes.
3. Provenance input enforcement: governed tools reject missing required fields.
4. Attribution preservation: `attribution_required` outputs include valid attribution plan.
5. Permission gating: `permission_required` paths enforce grant check and approval flow.
6. Consent gating: sensitive actions trigger user interaction checkpoint.
7. Idempotency: duplicate `toolCallId` does not duplicate side effects.
8. Audit completeness: claim/receipt and policy decision artifacts persisted.

## 26. Implementation Notes (Next.js + Tiptap + Drizzle + BetterAuth)
- Keep editor marks thin (entity references), with policy references by ID.
- Materialize segment policy state for fast rendering and enforcement checks.
- Run callbacks in background jobs to avoid blocking paste UX.
- Run tool-call policy checks in the same transaction boundary as write operations where possible.
- Provide clear UI states for allowed/attribution-required/pending/denied outcomes.
- Add grant manager UI with revoke and expiry controls.
- For WebMCP in SPA flows, track a monotonic context epoch and include it in all governed tool calls.

## 27. Open Items for v0.4
1. Harden cross-language text normalization edge cases.
2. Formal dispute and revocation protocol after accepted receipts.
3. Optional redacted or privacy-preserving transfer proofs.
4. Normative ODRL profile and validation requirements.
5. Cross-instance agent identity mapping profile.
6. Declarative WebMCP profile once the corresponding APIs stabilize.
