# CRP Hashing Specification

**Version:** 0.0.3

CRP uses deterministic SHA-256 hashing to produce content-addressed identifiers for clips, text, and artifacts. All hashes are encoded as base64url strings prefixed with `sha256-`.

---

## Hash Format

All content hashes in CRP follow the same format:

```
sha256-{base64url_digest}
```

Where `base64url_digest` is the SHA-256 digest encoded using RFC 4648 base64url (alphabet `A-Z`, `a-z`, `0-9`, `-`, `_`) with **no padding**.

Pattern: `^sha256-[A-Za-z0-9_-]{43,}$`

A SHA-256 digest is 32 bytes, which produces exactly 43 base64url characters (without padding).

---

## Text Hash

The text hash (`textHash`) fingerprints the normalized textual content of a clip.

### Algorithm

```
textHash = "sha256-" + base64url(SHA-256(normalize(text)))
```

### Steps

1. **Normalize** the input text:
   - Apply Unicode NFC normalization.
   - Replace all `\r\n` (CRLF) sequences with `\n` (LF).
   - Replace all remaining `\r` (CR) characters with `\n` (LF).
2. **Encode** the normalized text as UTF-8 bytes.
3. **Hash** the bytes with SHA-256.
4. **Encode** the 32-byte digest as base64url (no padding).
5. **Prefix** with `sha256-`.

### Normalization Rationale

Unicode NFC normalization ensures that equivalent character sequences (e.g., `e` + combining acute accent vs. precomposed `e-acute`) produce the same hash. Line ending normalization ensures that the same text produces the same hash regardless of the operating system where it was captured.

### Example (Pseudocode)

```
input    = "Provenance starts here."
nfc      = NFC("Provenance starts here.")  // no change for ASCII
utf8     = encode_utf8(nfc)                // 23 bytes
digest   = SHA-256(utf8)                   // 32 bytes
encoded  = base64url_no_pad(digest)        // 43 chars
textHash = "sha256-" + encoded
```

---

## Clip Hash

The clip hash (`clipHash`) uniquely identifies a clip based on its text hash, source references, and optionally the exact quoted text. This means two independent captures of the same text from the same source produce the same `clipHash`.

### Algorithm

```
clipHash = "sha256-" + base64url(SHA-256(JCS(canonical_object)))
```

### Steps

1. **Build** a canonical JSON object with the following fields:
   - `textHash` — the clip's text hash (string).
   - `sourceRefs` — the clip's source reference IDs, **sorted alphabetically** (array of strings).
   - `textQuoteExact` — the exact text from the text quote selector, **only if present** (string). If the clip has no text quote selector, this field is omitted entirely.
2. **Canonicalize** the object using JCS ([JSON Canonicalization Scheme, RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)). JCS produces a deterministic JSON serialization with sorted keys and no optional whitespace.
3. **Encode** the canonical JSON string as UTF-8 bytes.
4. **Hash** the bytes with SHA-256.
5. **Encode** the 32-byte digest as base64url (no padding).
6. **Prefix** with `sha256-`.

### Canonical Object Structure

When `textQuoteExact` is present:

```json
{"sourceRefs":["src_01","src_02"],"textHash":"sha256-...","textQuoteExact":"exact quote text"}
```

When `textQuoteExact` is absent:

```json
{"sourceRefs":["src_01","src_02"],"textHash":"sha256-..."}
```

Note: JCS sorts keys alphabetically, so the field order is always `sourceRefs`, `textHash`, then `textQuoteExact` (if present).

### Why These Fields

- **`textHash`** — ensures the clip hash changes when the text content changes.
- **`sourceRefs`** (sorted) — ensures the same text from different sources produces different clip hashes, while the order of source references does not matter.
- **`textQuoteExact`** — allows distinguishing clips captured with different quote contexts from the same source, when applicable.

---

## Artifact Hash

The artifact hash (`artifactHash`) identifies an artifact by its raw content.

### Algorithm

```
artifactHash = "sha256-" + base64url(SHA-256(raw_bytes))
```

### Steps

1. Read the artifact's raw bytes (the file content, not any JSON wrapper).
2. **Hash** the bytes with SHA-256.
3. **Encode** the 32-byte digest as base64url (no padding).
4. **Prefix** with `sha256-`.

No normalization is applied. The hash is computed over the exact bytes of the artifact.

---

## Verification

### Clip Hash Verification

To verify a clip's integrity:

1. Recompute `textHash` from `clip.content` using the text hash algorithm.
2. Compare the computed `textHash` against `clip.textHash`.
3. Recompute `clipHash` from `clip.textHash`, `clip.sourceRefs`, and `clip.selectors.textQuote.exact` (if present) using the clip hash algorithm.
4. Compare the computed `clipHash` against `clip.clipHash`.

If either comparison fails, the clip has been tampered with or was constructed incorrectly.

Note: Step 1 requires `clip.content` to be present. If content is omitted (e.g., in a summary bundle), only `clipHash` can be verified from its inputs.

### Bundle Verification

A full bundle verification checks:

1. All clip hashes (text hash and clip hash) are valid.
2. All `wasDerivedFrom` edges reference clip hashes that exist within the bundle.
3. All `sourceRefs` on clips reference source record IDs that exist within the bundle.

### Artifact Verification

To verify an artifact:

1. Recompute the SHA-256 hash of the artifact's raw bytes.
2. Compare against the `artifactHash` field.
3. Verify that `byteSize` matches the actual byte count.

---

## Implementation Notes

### Base64url Encoding

Standard base64 uses `+` and `/` as the 62nd and 63rd characters. Base64url replaces these with `-` and `_` respectively, and omits trailing `=` padding. This makes hashes safe for use in URLs, filenames, and JSON without escaping.

Conversion from standard base64:
1. Replace `+` with `-`.
2. Replace `/` with `_`.
3. Strip trailing `=` characters.

### JCS (JSON Canonicalization Scheme)

CRP uses [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) for deterministic JSON serialization in clip hash computation. Key properties:
- Object keys are sorted lexicographically by Unicode code point.
- No optional whitespace.
- Numbers use shortest representation without unnecessary trailing zeros.
- Strings use minimal escaping.

Implementations should use a compliant JCS library rather than hand-rolling serialization.
