# Schema vs Implementation Differences

Analysis comparing `schema/crp-v0.0.2.schema.json` against the implementations in
`packages/core`, `packages/extension`, and `apps/playground`.

---

## 1. `crpiVersion` vs `protocolVersion` (BUG - fixed)

| Location | Field used |
|---|---|
| Schema | `protocolVersion` (const `"0.0.2"`) |
| `core/bundle-builder.ts` | `protocolVersion` (correct) |
| `core/clipboard-reader.ts` | ~~`crpiVersion`~~ `protocolVersion` (was wrong, now fixed) |
| `playground/clipboard-read.ts` | Uses `validateBundle()` (correct, schema-driven) |

**Status:** Bug was in `core/clipboard-reader.ts:31`. The lightweight structural check used
`parsed.crpiVersion` which doesn't exist in the schema. This meant `parseBundleFromHtml()`
always returned `null` for valid bundles. Now fixed to `parsed.protocolVersion`.

**Impact:** Extension paste detection (`content.ts:135`) calls `parseBundleFromHtml()` and
was silently failing for every paste, so `bundleJson` was always `null` in the
`paste-detected` message sent to the background script.

---

## 2. Source records missing `sourceUri` and `title`

| Location | What it does |
|---|---|
| Schema `sourceRecord` | `sourceUri` (optional, format: uri), `title` (optional) |
| `core/bundle-builder.ts:85-89` | Creates source as `{ id: "src-page", sourceType: "unknown" }` only |
| `playground/bundle-merge.ts:100-108` | Reads `src.sourceUri` and `src.title` for display |
| `playground/ClipDetail.tsx:96-104` | Renders `sourceUri` as a clickable link |
| `playground/ClipList.tsx:23,38` | Shows `sourceUri` in clip list |

**Problem:** The bundle builder puts the URL in `document.uri` and the page title in
`document.title`, but the source record only has `{ id, sourceType }`. The playground
displays `sourceUri` and `title` from resolved sources, so these fields are always empty
for extension-produced bundles.

**Schema perspective:** Both approaches are valid per the schema -- `sourceUri` is optional
on `sourceRecord`, and `document.uri` is optional on `document`. The question is which is
the *intended* canonical location for the page URL.

**Options to align:**

- **Option A (populate source):** Have `bundle-builder.ts` set `sourceUri` and `title` on
  the source record itself:
  ```ts
  sources: [{
    id: sourceId,
    sourceType: 'unknown',
    sourceUri: documentInfo.uri,
    title: documentInfo.title,
  }]
  ```
  This is the most direct fix -- the data flows through `mergeBundles` into `ClipDetail`
  without any fallback logic. It does mean the URL appears in two places (`document.uri`
  and `sources[0].sourceUri`), but this is not a schema violation and makes the source
  record self-contained.

- **Option B (playground fallback):** Keep the builder as-is, have `mergeBundles` fall back
  to `bundle.document.uri` when `src.sourceUri` is missing (the workaround currently
  applied). This works but is a display-layer patch rather than fixing the data at the
  source. Other consumers of the bundle would also need the same fallback.

- **Option C (display document separately):** Add a "Document" section to `ClipDetail.tsx`
  that always renders `bundle.document.uri` and `bundle.document.title` independent of
  sources. This is semantically cleanest (document and source are different concepts) but
  requires threading the bundle's document info through the merge/store layer, which
  currently only surfaces resolved sources.

**Recommendation:** Option A. Populate `sourceUri` and `title` on the source record in the
builder. The schema supports it, it makes the source record useful on its own, and every
consumer gets the data without special handling. The `document` object can remain as a
separate structural anchor for `documentId` references.

---

## 3. `digitalSourceType` not used anywhere

| Location | Status |
|---|---|
| Schema `sourceRecord` | `digitalSourceType` (optional, format: uri) |
| `core/bundle-builder.ts` | Not set |
| `playground/bundle-merge.ts` `ResolvedSource` | Not included |
| `playground/ClipDetail.tsx` | Not rendered |

**Impact:** Low. This is an optional field for future C2PA/IPTC alignment. No
implementation references it yet, but it's also not causing issues.

---

## 4. `document` object not surfaced in playground display

| Location | Status |
|---|---|
| Schema | `document` is optional, has `id`, `uri` (optional), `title` (optional), `canonicalHash` (optional) |
| `core/bundle-builder.ts` | Populates `document.id`, `document.uri`, and conditionally `document.title` |
| `playground/bundle-merge.ts` | Does not include `document` in `MergedClip` or `MergedState` |
| `playground/ClipDetail.tsx` | No "Document" section; shows `clip.documentId` nowhere |

**Problem:** The `document` object is the only place where the page URL and title live in
extension bundles (since `sourceUri`/`title` aren't set on source records). The playground
never reads `bundle.document` for display purposes. The `MergedClip` type has a
`documentId` field but it's never rendered.

**Recommendation:** Even after fixing the source records (issue #2), consider adding a
Document section to `ClipDetail` since `document` and `source` are semantically different.
The document is "where this came from" (the web page), while sources describe the
authorship/provenance type. A merged multi-bundle view could show which document each clip
belongs to.

---

## 5. HTML entity decoding asymmetry

| Location | Entities handled |
|---|---|
| `core/html-utils.ts` `escapeAttr()` | Encodes: `&`, `"`, `<`, `>` |
| `core/clipboard-reader.ts` `parseBundleFromHtml()` | Decodes: `&amp;`, `&quot;`, `&lt;`, `&gt;` |
| `extension/content.ts` `escapeAttr()` (local copy) | Encodes: `&`, `"`, `<`, `>` |
| `playground/clipboard-read.ts` `parseBundleFromHtml()` | Decodes: `&amp;`, `&quot;`, `&lt;`, `&gt;` |

**Status:** Symmetric and correct. The same four entities are encoded on write and decoded
on read. Note that `&#39;` (single quote) is not needed since the attribute uses double
quotes.

However, there is a potential edge case: if the JSON bundle contains a literal `&amp;` or
similar entity-like string, the naive string-replace decode could corrupt it. Example:
a document title containing `"AT&amp;T"` would be double-decoded. In practice this is
unlikely since the JSON is machine-generated, but a proper HTML entity decoder would be
more robust.

---

## 6. Duplicated `escapeAttr` function

| Location | Implementation |
|---|---|
| `core/html-utils.ts:5-11` | Canonical implementation |
| `extension/content.ts:215-221` | Identical local copy |

**Problem:** The extension has its own copy of `escapeAttr` at the bottom of `content.ts`
even though it already imports from `@cliproot/core` (which re-exports `escapeAttr` from
`html-utils.ts`). The two implementations are identical, but maintaining two copies is a
drift risk.

**Recommendation:** Remove the local `escapeAttr` from `content.ts` and import it from
`@cliproot/core`. The extension already depends on `@cliproot/core` for
`captureSelection`, `buildClipboardBundle`, etc.

---

## 7. Duplicated `parseBundleFromHtml` function

| Location | Validation approach |
|---|---|
| `core/clipboard-reader.ts` | Lightweight structural check (CSP-safe, no AJV) |
| `playground/clipboard-read.ts` | Full `validateBundle()` via AJV |

**Problem:** The playground has its own copy of the HTML-to-bundle extraction logic because
the playground doesn't depend on `@cliproot/core`. The two implementations differ in
validation strategy (lightweight vs full schema), which is intentional -- the core version
must be CSP-safe for extension content scripts, while the playground can use full
validation.

**Options:**
- Add `@cliproot/core` as a dependency to the playground and import `parseBundleFromHtml`,
  then optionally re-validate with `validateBundle()` afterward. This removes the
  duplicated regex/decode logic.
- Keep them separate but document the intentional divergence.

---

## 8. `ResolvedSource.sourceType` is `string` not enum

| Location | Type |
|---|---|
| Schema `sourceRecord.sourceType` | Enum: `"human-authored"`, `"ai-generated"`, `"ai-assisted"`, `"external-quoted"`, `"unknown"` |
| `playground/bundle-merge.ts` `ResolvedSource` | `sourceType: string` |
| `playground/Badge.tsx` `SourceBadge` | Hardcoded color map for the 5 enum values |

**Impact:** Low. TypeScript won't catch a misspelled source type. The badge component
handles unknown values gracefully (falls back to gray). Could be tightened by using the
schema-derived type, but this is cosmetic.

---

## 9. `ResolvedActivity.createdAt` is required but schema says optional

| Location | `createdAt` |
|---|---|
| Schema `activity` | Required: `["id", "activityType", "createdAt"]` -- it IS required |
| `playground/bundle-merge.ts` `ResolvedActivity` | `createdAt: string` (required, correct) |

**Status:** Aligned. No issue.

---

## 10. Schema fields with `default: []` vs implementation null checks

| Location | Handling |
|---|---|
| Schema | `agents`, `sources`, `clips`, `activities`, `derivationEdges`, `reuseEvents`, `signatures` all have `"default": []` |
| `playground/bundle-merge.ts` | Guards with `if (bundle.agents)`, `if (bundle.sources)`, etc. |
| `core/bundle-builder.ts` | Only includes `derivationEdges` conditionally via spread |

**Observation:** The schema specifies `default: []` for array fields, which means a
compliant validator should fill in empty arrays for missing fields. However, since
`validateBundle()` uses AJV with `useDefaults` potentially not enabled, and the lightweight
check in `parseBundleFromHtml` definitely doesn't apply defaults, the runtime values could
be `undefined`. The null guards in `mergeBundles` are therefore correct and defensive.

Worth checking: does the AJV validator in `packages/protocol/src/validate.ts` have
`useDefaults: true`? If so, validated bundles will always have these arrays, but
lightweight-checked bundles from the extension won't.

---

## Summary of recommended actions

| Priority | Issue | Fix location |
|---|---|---|
| **High** | Source records missing `sourceUri`/`title` (#2) | `core/bundle-builder.ts` |
| **Done** | `crpiVersion` typo (#1) | `core/clipboard-reader.ts` |
| **Medium** | Document info not displayed (#4) | `playground/ClipDetail.tsx` + `bundle-merge.ts` |
| **Low** | Duplicated `escapeAttr` (#6) | `extension/content.ts` |
| **Low** | Duplicated `parseBundleFromHtml` (#7) | `playground/clipboard-read.ts` |
| **Low** | `ResolvedSource.sourceType` not typed as enum (#8) | `playground/bundle-merge.ts` |
| **None** | `digitalSourceType` unused (#3) | Future work |
| **None** | Entity decoding edge case (#5) | Low risk |
| **None** | Schema defaults vs null guards (#10) | Correct as-is |
