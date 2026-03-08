Nice — below is a production-ready JSON Schema (vocab: draft-2020-12 style) for the provenance protocol we sketched. It covers users, documents, canonical provenance records, span attributions, reuse/handshake events, clipboard bundles, and signatures.

This spec is intentionally database- and UI-agnostic so it can be used by integrations with editors such as Tiptap, apps built on Next.js deployed to platforms like Vercel, backends using ORMs such as Drizzle, and auth systems like BetterAuth. It’s also designed so it can map to formal cliproot/claim systems such as the Coalition for Content Provenance and Authenticity model in later iterations, and can later be extended for CRDT integrations like Yjs.

---

# JSON Schema — Provenance Protocol (v0.1)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.org/schemas/cliproot-protocol.v0.1.json",
  "title": "Provenance Protocol — Root Schema",
  "description": "Root schema container. See $defs for domain types: User, Document, ProvenanceRecord, SpanAttribution, ReuseEvent, ClipboardBundle, Signature.",
  "type": "object",
  "properties": {
    "schemaVersion": {
      "type": "string",
      "description": "Protocol version.",
      "examples": ["0.1"]
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO-8601 timestamp when this package was generated."
    },
    "payload": {
      "type": "object",
      "description": "Arbitrary top-level container depending on usage (document export, clipboard bundle, reuse event)."
    }
  },
  "required": ["schemaVersion", "generatedAt"],
  "$defs": {
    "idPattern": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_-]{2,63}$",
      "description": "Generic stable id pattern (lowercase start, 3-64 chars). Each domain type has a recommended prefix (e.g. prov_..., doc_..., user_...)."
    },

    "User": {
      "type": "object",
      "description": "A person or system with an identity in the platform.",
      "properties": {
        "id": { "$ref": "#/$defs/idPattern", "description": "User id, e.g. user_jane" },
        "displayName": { "type": "string" },
        "email": { "type": "string", "format": "email" },
        "profileUrl": { "type": "string", "format": "uri", "nullable": true },
        "publicKey": { "type": "string", "description": "Optional public key (PEM or JWK) for signature verification.", "nullable": true },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["id", "displayName", "createdAt"]
    },

    "Document": {
      "type": "object",
      "description": "A stored document container. The editor state (Tiptap/ProseMirror JSON) can be stored in `content`.",
      "properties": {
        "id": { "$ref": "#/$defs/idPattern" },
        "ownerId": { "$ref": "#/$defs/idPattern", "description": "FK to User.id" },
        "title": { "type": "string" },
        "content": { "type": "object", "description": "Opaque editor JSON (app-specific).", "nullable": true },
        "canonicalText": { "type": "string", "description": "Normalized flattened text representation (for character offsets & hashing).", "nullable": true },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["id", "ownerId", "title", "createdAt", "updatedAt"]
    },

    "Signature": {
      "type": "object",
      "description": "A cryptographic signature describing algorithm and signer reference.",
      "properties": {
        "algorithm": { "type": "string", "examples": ["rsa-pss-sha256", "ecdsa-secp256k1-sha256"] },
        "signature": { "type": "string", "description": "Base64-encoded signature bytes." },
        "signerId": { "$ref": "#/$defs/idPattern", "description": "Entity that signed this payload (could be user_... or system_...)" },
        "publicKey": { "type": "string", "description": "Optional public key used to verify signature (PEM or JWK).", "nullable": true },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["algorithm", "signature", "signerId", "createdAt"]
    },

    "ProvenanceRecord": {
      "type": "object",
      "description": "Canonical provenance object describing the source of some text or asset.",
      "properties": {
        "id": { "type": "string", "pattern": "^prov_[a-z0-9_-]{3,60}$" },
        "sourceType": {
          "type": "string",
          "enum": ["human", "ai", "external", "unknown"],
          "description": "High-level source classification."
        },
        "authorUserId": { "$ref": "#/$defs/idPattern", "description": "Optional reference to a registered user." },
        "authorName": { "type": "string", "nullable": true },
        "sourceUrl": { "type": "string", "format": "uri", "nullable": true },
        "sourceDocumentId": { "$ref": "#/$defs/idPattern", "nullable": true },
        "ai": {
          "type": "object",
          "description": "If sourceType == ai, describe model details.",
          "properties": {
            "modelName": { "type": "string" },
            "modelVersion": { "type": "string", "nullable": true },
            "promptHash": { "type": "string", "nullable": true }
          },
          "required": ["modelName"],
          "additionalProperties": false,
          "nullable": true
        },
        "originalHash": { "type": "string", "description": "Hash of the original content (sha256:hex or sha256:base64).", "nullable": true },
        "notes": { "type": "string", "nullable": true },
        "createdBy": { "$ref": "#/$defs/idPattern", "description": "who created this provenance record (user or system)" },
        "createdAt": { "type": "string", "format": "date-time" },
        "derivedFrom": {
          "type": "array",
          "items": { "type": "string", "pattern": "^prov_[a-z0-9_-]{3,60}$" },
          "description": "Optional list of provenance ids this record was derived from."
        },
        "assertions": {
          "type": "object",
          "description": "Arbitrary claim/assertion map (reserved for C2PA-style mappings or later extensions).",
          "additionalProperties": true,
          "nullable": true
        },
        "signatures": {
          "type": "array",
          "items": { "$ref": "#/$defs/Signature" },
          "nullable": true,
          "description": "Optional signatures that vouch for this provenance record."
        }
      },
      "required": ["id", "sourceType", "createdBy", "createdAt"]
    },

    "SpanLocation": {
      "type": "object",
      "description": "Location of an attributed span. Provide either character offsets (flattened canonical text) or a path-based location.",
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "type": { "const": "chars" },
            "start": { "type": "integer", "minimum": 0 },
            "end": { "type": "integer", "minimum": 0 }
          },
          "required": ["type", "start", "end"]
        },
        {
          "type": "object",
          "properties": {
            "type": { "const": "path" },
            "nodePath": {
              "type": "array",
              "items": { "type": "integer" },
              "description": "ProseMirror node path indexes from root into document tree."
            },
            "startOffset": { "type": "integer", "minimum": 0 },
            "endOffset": { "type": "integer", "minimum": 0 }
          },
          "required": ["type", "nodePath", "startOffset", "endOffset"]
        }
      ]
    },

    "SpanAttribution": {
      "type": "object",
      "description": "An attribution linking a provenance record to a span in a document.",
      "properties": {
        "id": { "type": "string", "pattern": "^span_[a-z0-9_-]{3,60}$" },
        "documentId": { "$ref": "#/$defs/idPattern" },
        "provenanceId": { "type": "string", "pattern": "^prov_[a-z0-9_-]{3,60}$" },
        "location": { "$ref": "#/$defs/SpanLocation" },
        "spanHash": { "type": "string", "description": "SHA256 of normalized span text (recommended).", "nullable": true },
        "createdBy": { "$ref": "#/$defs/idPattern" },
        "createdAt": { "type": "string", "format": "date-time" },
        "notes": { "type": "string", "nullable": true }
      },
      "required": ["id", "documentId", "provenanceId", "location", "createdBy", "createdAt"]
    },

    "ReuseEvent": {
      "type": "object",
      "description": "Event created when a destination imports/pastes content that references a provenance record. Models the handshake.",
      "properties": {
        "id": { "type": "string", "pattern": "^reuse_[a-z0-9_-]{3,60}$" },
        "sourceProvenanceId": { "type": "string", "pattern": "^prov_[a-z0-9_-]{3,60}$" },
        "sourceDocumentId": { "$ref": "#/$defs/idPattern", "nullable": true },
        "destinationDocumentId": { "$ref": "#/$defs/idPattern", "nullable": true },
        "destinationUserId": { "$ref": "#/$defs/idPattern", "nullable": true },
        "timestamp": { "type": "string", "format": "date-time" },
        "acknowledged": { "type": "boolean", "description": "Has the source acknowledged this reuse?" },
        "acknowledgementSignature": { "$ref": "#/$defs/Signature", "nullable": true },
        "notes": { "type": "string", "nullable": true }
      },
      "required": ["id", "sourceProvenanceId", "timestamp", "acknowledged"]
    },

    "ClipboardSpan": {
      "type": "object",
      "properties": {
        "text": { "type": "string" },
        "provId": { "type": "string", "pattern": "^prov_[a-z0-9_-]{3,60}$", "nullable": true },
        "spanHash": { "type": "string", "nullable": true }
      },
      "required": ["text"]
    },

    "ClipboardBundle": {
      "type": "object",
      "description": "Payload to transport on the clipboard using MIME `application/x-provenance+json`. Includes one or more spans and full provenance objects to enable cross-app transfer.",
      "properties": {
        "version": { "type": "string", "examples": ["1.0"] },
        "html": { "type": "string", "description": "Optional HTML serialized selection (may include data-prov-id attributes)." },
        "text": { "type": "string", "description": "Plain-text fallback." },
        "spans": {
          "type": "array",
          "items": { "$ref": "#/$defs/ClipboardSpan" },
          "description": "Linearized spans for the selection in order."
        },
        "provenance": {
          "type": "array",
          "items": { "$ref": "#/$defs/ProvenanceRecord" },
          "description": "Full provenance objects referenced by spans (allows transfer between systems)."
        },
        "createdAt": { "type": "string", "format": "date-time" },
        "sourceApp": { "type": "string", "description": "Optional identifier or URL of the app producing this bundle." }
      },
      "required": ["version", "text", "spans", "provenance", "createdAt"]
    },

    "ProvenanceBundleExport": {
      "type": "object",
      "description": "Full document export (document + provenance map + span attributions + optional signatures). Useful for C2PA-like packaging or JSON export.",
      "properties": {
        "exportId": { "type": "string", "pattern": "^export_[a-z0-9_-]{3,60}$" },
        "document": { "$ref": "#/$defs/Document" },
        "provenanceRecords": { "type": "array", "items": { "$ref": "#/$defs/ProvenanceRecord" } },
        "spanAttributions": { "type": "array", "items": { "$ref": "#/$defs/SpanAttribution" } },
        "reuseEvents": { "type": "array", "items": { "$ref": "#/$defs/ReuseEvent" }, "nullable": true },
        "signatures": { "type": "array", "items": { "$ref": "#/$defs/Signature" }, "nullable": true },
        "exportedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["exportId", "document", "provenanceRecords", "spanAttributions", "exportedAt"]
    }
  }
}
```

---

# Short notes & guidance

* **Span location:** the schema supports either character-offset ranges (useful for flattened canonical text and cross-editor matching) or ProseMirror node-path + offsets (useful if your host app wants precise structural locations). Choose one canonical approach for your storage and stick with it; storing both (character offsets and node path) is recommended for robustness and cross-checking.
* **Hashing:** use a normalized-text hashing rule (e.g., lowercase, normalize whitespace, normalize Unicode NFC) and then SHA-256; store as hex or base64. The `spanHash` and `originalHash` fields are optional but strongly recommended.
* **Signatures:** `Signature` is intentionally flexible — for the POC you can implement server-side signing (convenient) and/or user-held client-side keys (more private/trustworthy). Keep `publicKey` data for verification.
* **Clipboard transport:** put the full provenance objects into the clipboard bundle so other apps that understand the protocol can ingest provenance without a network round-trip. Also include HTML with `data-prov-id` attributes as best-effort inline hints.
* **Reuse events / handshake:** the `ReuseEvent` schema supports optional acknowledgement and signature fields so the source can cryptographically acknowledge reuse. For the POC you can implement a simple HTTP webhook/notification, later replace with signed acknowledgement flows.
* **Extensibility:** `assertions` on `ProvenanceRecord` allows mapping to standards such as Coalition for Content Provenance and Authenticity claims later. Keep it open (`additionalProperties: true`) for now.
* **Privacy & ergonomics:** never expose private provenance metadata without user consent. Provide redaction or private/limited-scope provenance modes.

---

If you want, next I can:

* Produce TypeScript `zod` or `typescript` interfaces derived from this JSON Schema, ready to drop into a Next.js + Drizzle codebase.
* Or I can generate example JSON instances (small sample document, clipboard bundle, reuse event) demonstrating the full end-to-end lifecycle.

Which of those would be most useful right now?
