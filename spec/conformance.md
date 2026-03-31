# CRP Conformance

**Version:** 0.0.3
**Status:** Draft — conformance criteria will be refined as the protocol stabilizes.

---

## Overview

A **CRP-conformant** implementation is one that can produce and/or consume CRP bundles that are interoperable with other conformant implementations. This document defines the minimum requirements.

---

## Requirements

### Bundle Production

An implementation that produces CRP bundles must:

1. **Schema validity.** Every bundle must validate against `schema/crp-v0.0.3.schema.json`.
2. **Protocol version.** `protocolVersion` must be `"0.0.3"`.
3. **Text hashing.** `textHash` must be computed per the [text hash algorithm](hashing.md#text-hash): Unicode NFC normalization, LF line endings, SHA-256, base64url encoding.
4. **Clip hashing.** `clipHash` must be computed per the [clip hash algorithm](hashing.md#clip-hash): JCS-canonicalized JSON of `textHash`, sorted `sourceRefs`, and optional `textQuoteExact`, then SHA-256 and base64url encoding.
5. **Referential integrity.** All `sourceRefs` on clips must reference source record IDs present in the same bundle. All `wasDerivedFrom` edge `subjectRef` and `objectRef` values must reference clip hashes present in the same bundle.

### Bundle Consumption

An implementation that consumes CRP bundles must:

1. **Schema validation.** Validate incoming bundles against the CRP JSON Schema before processing.
2. **Hash verification.** Verify `clipHash` and `textHash` for all clips where `content` is present.
3. **Graceful handling.** Reject bundles that fail schema validation or hash verification with a clear error, rather than silently accepting invalid data.

### Pack Production and Consumption

An implementation that produces or consumes `.cliprootpack` archives must additionally meet the verification requirements defined in the [pack format specification](pack-format.md#verification).

---

## What Conformance Does Not Require

- **Full entity support.** An implementation may support a subset of bundle types (e.g., only `clipboard` bundles) or entity types (e.g., no artifact support). It must still produce valid bundles for the types it does support.
- **Storage format.** How an implementation stores bundles locally (filesystem, database, in-memory) is not specified.
- **Transport.** How bundles are transmitted (clipboard, HTTP, file, MCP) is not specified.
- **Signature verification.** Signature support is optional. Implementations that do not produce or consume signatures are still conformant.

---

## Future Directions

As CRP stabilizes, this document will be expanded to cover:

- Conformance levels (e.g., minimal, standard, full).
- A test vector suite for validating hash computation and schema compliance.
- Interoperability testing procedures between implementations.
