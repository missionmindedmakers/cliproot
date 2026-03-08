<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# I am working on an app that tracks the provenance of each span in a document. If you import, or paste something in off the clipboard it tracks  who authored it. It also tracks what was AI generated. The originator of the content can track where it was cited. I want to do some research to investigate what similar protocols exist. I know of some blockchain based alternatives such as the story protocol. Can you do a more comprehensive analysis?

You’re essentially in the same problem space as a few emerging but fairly distinct ecosystems: media authenticity (C2PA/CAI), generic web provenance (W3C PROV), content identifiers (ISCC, DOI), scholarly citation graphs (Crossref/ORCID), and Web3 IP registries (Story Protocol‑style). Together they cover big pieces of what you want, but none of them does “span‑level provenance + cross‑document citation tracking + AI/human distinction” out of the box.

Below is a structured pass through what exists and how it maps to what you’re building.

***

## Problem you’re tackling

You’re trying to:

- Track provenance at fine granularity (spans/segments of a document), including who authored them and whether they were AI- vs human-generated.
- Preserve a derivation graph when content is imported, pasted, or transformed, so “originators” can see where their content is reused or cited.
- Potentially support this as a protocol other apps could interoperate with.

Most existing efforts either work at the *asset* level (whole image/video/doc) or at the *document/work* level (papers, datasets), not spans, but their data models and vocabularies are reusable.

***

## Major media authenticity standards (C2PA / CAI / IPTC)

### C2PA and Content Credentials

The **Coalition for Content Provenance and Authenticity (C2PA)** defines an open standard for cryptographically bound “Content Credentials” (manifests) that describe the provenance of a digital asset (image, video, audio, document). [^1] These manifests are attached to the asset and can include assertions like origin description and details of edits or transformations, all signed so tampering is detectable. [^1]

The **Content Authenticity Initiative (CAI)**, started by Adobe, NYT, and Twitter, promotes adoption of this standard (they call the manifests “Content Credentials”) as a way to attach secure provenance metadata—publisher, capture device, time, editing steps—to any digital media, including text, secured with hashes and digital signatures. [^2]

Key things relevant to you:

- C2PA has a clear notion of *provenance as a sequence of assertions* (capture, edit, export, etc.), each attributed to an actor and time, bound cryptographically to the asset. [^1][^2]
- It is being adopted in tooling (newsrooms, cameras, Adobe apps) as a “nutrition label” style UX for authenticity. [^3][^2]
- It already integrates with AI-related metadata via IPTC’s “digital source type” vocabulary (see below). [^4]

You could adapt the *architecture*—signed, append-only manifests—but make your “asset” a document plus an internal graph of spans and their lineage.

### IPTC “Digital Source Type” and AI flags

The IPTC Photo/Video Metadata standard introduced a **“Digital Source Type”** vocabulary with specific values for machine-generated or hybrid “synthetic media” (e.g., “trainedAlgorithmicMedia” and “compositeSynthetic”). [^4] Their guidance explicitly recommends that AI-generative tools set these values in embedded metadata or in a C2PA manifest, and provides URIs for each term. [^4]

Relevance:

- There is already a reasonably accepted vocabulary for distinguishing:
    - Human-captured content
    - Purely AI-generated content
    - Hybrid composites with synthetic elements. [^4]
- C2PA can carry these IPTC assertions in its manifest. [^4]

For your app, you can reuse this vocabulary for span-level labels (e.g., “trainedAlgorithmicMedia” vs “humanEdited”) even if you don’t use the full C2PA stack.

***

## Generic provenance data model: W3C PROV

The **W3C PROV Ontology (PROV‑O)** is *the* generic standard for expressing provenance on the web. [^5] It defines three core classes:

- **Entity** – something that exists (a dataset, document, or in your case, a span).
- **Activity** – a process that uses and generates entities over time (e.g., “pasting from clipboard”, “LLM generation”, “user edit”). [^5]
- **Agent** – something responsible for entities or activities (a person, organization, or software/AI system). [^5]

Relations like `prov:used`, `prov:wasGeneratedBy`, `prov:wasDerivedFrom`, `prov:wasAttributedTo`, and `prov:actedOnBehalfOf` allow you to build provenance chains linking Entities, Activities, and Agents. [^5] PROV is widely reused across domains, and people often design their own domain ontologies and map them onto these three core classes and relations. [^6]

For your use case:

- Treat each span (or content chunk) as a **PROV Entity**.
- Treat paste/import/generation/edit operations as **Activities** that `prov:used` one or more Entities and `prov:wasGeneratedBy` new ones. [^5]
- Treat users and AI models as **Agents** that `prov:wasAssociatedWith` Activities and `prov:wasAttributedTo` the resulting Entities. [^5]

That gives you an interoperable graph model for content lineage; you can serialize it as JSON-LD, TTL, etc.

***

## Content identifiers: ISCC and ISO 24138

The **International Standard Content Code (ISCC)** is an open-source system that generates a **content-derived identifier** for any digital media file (text, images, audio, video). [^7] Instead of registering an arbitrary ID, the code is deterministically constructed from multiple hash digests of the content, so each asset can “emit” its own identifier based on its digital properties. [^7][^8] ISCC has now been standardized as **ISO 24138:2024**, which specifies syntax, structure, metadata, and its use alongside schemes like DOI, ISBN, ISRC, etc. [^8]

Key properties:

- It’s **decentralized and tamper-resistant**: anyone with the content can derive the same identifier. [^7][^8]
- It’s media-agnostic and intended to support identification, attribution, and rights management across platforms. [^7][^8]

For your app, ISCC is interesting as a building block:

- You could derive **ISCC-like codes at the span or block level**, so that if a chunk appears in another document, you can link it back to its originators via the shared code.
- Because it’s an ISO standard and designed to co-exist with DOIs etc., it’s a good candidate if you want others to resolve your identifiers or align them with existing ecosystems. [^8]

***

## Web3 / blockchain IP registries: Story Protocol

**Story Protocol** is a Layer 1 blockchain that acts as a global registry for creative works—turning IP into on-chain assets with programmable licensing, royalties, and attribution. [^9] Creators mint NFTs as IP assets, attach programmable IP licenses, and use modules for licensing, dispute resolution, metadata, and royalty distribution; the system’s IP token is used for transactions and governance. [^10][^9]

A few relevant aspects:

- On-chain registration provides a **public, immutable log** of IP assets and derivatives; “Proof-of-Creativity” is used to register IP as on-chain assets. [^10][^9]
- Licensing and royalty modules encode how derivatives must attribute or pay upstream creators. [^10][^9]

Compared to what you want:

- Story gives you **global IP object identity and a derivatives/attribution graph** at an asset level, but it does not address span-level provenance within a document. [^9]
- You could, however, anchor *document-level* or *manifest-level* hashes on-chain in a Story-like system for tamper-evidence, while keeping your fine-grained graph off-chain.

***

## Scholarly identifiers and citation graphs (DOI, Crossref, ORCID)

While this is a different domain, it’s the closest mature example of “originator can see who cited my work”.

### DOIs and Crossref’s Cited-by service

**Crossref** assigns DOIs to scholarly content and maintains a metadata graph including references and citations. [^11] Through its **Cited-by** service, Crossref can return all DOIs that cite a given DOI via an API, effectively giving “forward citations.” [^12] Publishers can retrieve all citations for a DOI or DOI prefix, and can also subscribe to alerts when new citations appear. [^12]

So for each article (a document-level unit), Crossref maintains:

- A stable identifier (DOI). [^12]
- The list of works it cites and the works that cite it, via query endpoints. [^12]

This is highly analogous to what you want at a **span** level, just that Crossref’s graph is per-work, not per-fragment.

### ORCID for author identity

**ORCID** provides persistent identifiers for researchers and links them to their works, many of which are registered via Crossref DOIs. [^11] Crossref and ORCID collaborate so that article metadata includes ORCID IDs for authors, enabling unambiguous attribution and automatic updates of an author’s ORCID record when a new publication is registered. [^11]

For your app:

- ORCID is an existence proof that **person identifiers + work identifiers** + a central registry can do large-scale attribution at Internet scale. [^11]
- Conceptually, you’d be building “ORCID + Crossref, but for arbitrary digital content spans instead of scholarly articles.”

***

## Fine-grained, semantic-web provenance: Nanopublications

**Nanopublications** are a semantic-web format for representing tiny, citable units of knowledge with embedded provenance. [^13] Each nanopublication has three RDF graphs:

- An **assertion graph** containing the actual claim or data (e.g., a single triple or a small set of triples). [^13]
- A **provenance graph** describing how that assertion came about (methods, sources, etc.). [^13]
- A **publication info graph** describing the nanopublication itself (who created it, when, via what system). [^13]

They are stored as RDF (often in TriG syntax), and designed so that individual assertions (not whole papers) can be shared, cited, and trusted based on their provenance. [^13]

This is very close in spirit to your idea of span-level provenance:

- Treat each *span* or even each *statement* as a nanopublication-like unit.
- The provenance graph records whether it came from a paste, LLM output, or user edit, and from which prior entity. [^13]
- The publication info graph records the software (your app), user, and timestamps. [^13]

Nanopubs are a good design reference if you want each span to be independently citable.

***

## Packaging datasets and workflows: RO‑Crate

**RO‑Crate (Research Object Crate)** is a method for packaging research data and related assets as a single digital object with a rich, JSON‑LD metadata file describing its contents. [^14] It supports metadata from high-level (“who/what/where”) down to file-level or even variable-level inside files, and can include provenance and workflow information to aid reuse. [^14]

Core ideas:

- One **linked-data metadata document** (JSON‑LD with schema.org annotations) describes all resources inside the crate. [^14]
- Each resource (file, script, dataset) has its own machine-readable description; provenance and workflow steps can be encoded for reproducibility. [^14]

RO‑Crate is more about dataset packages than in-document spans, but the pattern—“one JSON‑LD manifest for a collection, with per-part metadata and provenance”—is very similar to what you want for a document.

***

## How these map to your app’s design

You can think of your protocol as a mash-up of:

- **PROV‑O** for the underlying graph model (Entities = spans, Activities = operations, Agents = users/AI). [^5]
- **IPTC digital source types** to classify spans as human-written, LLM-generated, or hybrid. [^4]
- **Nanopublication/RO‑Crate style packaging** for turning a document + its provenance graph into a portable manifest (likely JSON‑LD). [^13][^14]
- **ISCC-like identifiers** for deduplicating and tracking spans across documents. [^7][^8]
- **Crossref/ORCID and Story Protocol patterns** for building a registry and “forward links” so originators can see where their content is reused, with optional blockchain anchoring if you care about public immutability. [^12][^11][^9]

Concretely, a protocol for your app could:

1. **Model:**
    - Represent each span as a PROV Entity with:
        - A content hash / ISCC-derived identifier.
        - Source-type classification (IPTC digitalSourceType). [^4]
    - Represent each operation (paste, generate, edit, refactor) as a PROV Activity with links to input and output Entities. [^5]
    - Represent human users and AI models as PROV Agents. [^5]
2. **Manifest:**
    - For each document, produce a **JSON‑LD manifest** (RO‑Crate style) that:
        - Enumerates spans and their identifiers. [^14]
        - Contains the full PROV graph of derivations and attributions. [^5]
        - Optionally embeds a C2PA-like signed “content credential” for the whole document, binding the manifest to a root hash of the content. [^1]
3. **Registry and citation tracking:**
    - Expose a service similar to **Crossref’s Cited‑by API** for your identifiers, so clients can ask “what other documents refer to this span or span-ID?” [^12]
    - Optionally anchor root manifests (or span IDs) on-chain using a Story‑style registry or a more generic chain, if you want a public, immutable log of registrations and licenses. [^9]
4. **AI-specific semantics:**
    - Use IPTC’s AI-related digital source types for spans. [^4]
    - Represent LLMs as Agents and the “generation” as an Activity that `prov:used` a prompt (which may itself be composed of other spans/entities). [^5]

***

## Gaps and opportunities vs existing protocols

Where you’re going beyond current practice:

- **Granularity:** C2PA, ISCC, DOIs, and Story Protocol all mostly work at file/asset/work level, whereas you care about span-level entities and operations. [^1][^7][^8][^9]
- **Citation graph for arbitrary content:** Crossref’s forward-link infrastructure is the main mature example of “originator sees all citers,” but only for articles with DOIs. [^12] Applying that concept to general content fragments is new.
- **LLM-native semantics:** IPTC and C2PA have first steps toward AI-generated flags, but not full modeling of “LLM X, with prompt Y, yielded span Z, which was then edited by human H.” [^4][^1]

If you want to do more targeted digging from here, useful rabbit holes are:

- C2PA’s full spec (esp. how they structure manifests and assertions). [^1]
- ISCC’s technical docs and ISO 24138 details (how they derive and structure identifiers). [^7][^8]
- Nanopublication tools and best practices for publishing and resolving fine-grained citable units. [^13]

If you’d like, next step could be to sketch an actual JSON‑LD schema for a “provenanced span” and a document‑level manifest, reusing PROV‑O, IPTC terms, and an ISCC-style identifier, and then talk about how an external registry/graph service for those IDs would look.
<span style="display:none">[^15]</span>

<div align="center">⁂</div>

[^1]: https://c2pa.org/specifications/specifications/2.3/explainer/Explainer.html

[^2]: https://en.wikipedia.org/wiki/Content_Authenticity_Initiative

[^3]: https://www.linkedin.com/posts/anandicade_adobe-content-authenticity-c2pa-and-the-activity-7379191063061676033-ysgl

[^4]: https://iptc.org/news/iptc-publishes-metadata-guidance-for-ai-generated-synthetic-media/

[^5]: https://www.w3.org/TR/prov-o/

[^6]: https://commons.esipfed.org/node/1982

[^7]: https://iscc.io

[^8]: https://www.iso.org/standard/77899.html

[^9]: https://www.datawallet.com/crypto/story-protocol-explained

[^10]: https://www.okx.com/en-us/learn/is-story-protocol-legit-ip-token-blockchain

[^11]: https://info.orcid.org/crossref-and-orcid-collaborate-to-accurately-attribute-authorship-of-scholarly-content/

[^12]: https://www.crossref.org/documentation/cited-by/retrieve-citations/

[^13]: https://nanopub.net/guidelines/working_draft/

[^14]: https://www.rrkive.org/standards/ro-crate/

[^15]: https://chesa.com/understanding-c2pa-enhancing-digital-content-cliproot-and-authenticity/

