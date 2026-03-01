# Span-level Provenance Notion-like Editor — Cloud POC Plan

> Updated direction: Cloud-first POC (Next.js + Vercel) prioritizing authentication, persistence, attribution visualization, and source↔destination handshake tracking over local-first CRDT collaboration.

---

## Updated Vision

This POC is:

- 🌍 **Cloud-based and public-facing** (broad audience)
- 🔐 Authenticated (users have identity)
- 🗄️ Backed by a database (durable provenance + attribution graph)
- 🎨 Focused on visualizing attribution clearly
- 🤝 Designed to demonstrate a "handshake" model between content source and destination

Collaboration (Yjs real-time CRDT) becomes a *later phase* after provenance + identity + handshake model are solid.

---

# 1. High-Level Architecture (Cloud First)

## Frontend

- **Next.js (App Router)**
- **React**
- **Tiptap** (ProseMirror-based editor)
- Hosted on **Vercel**

## Backend (within Next.js)

- Route handlers / server actions
- Database via **Drizzle ORM**
- Auth via **BetterAuth**
- PostgreSQL (Neon, Supabase, or Vercel Postgres)

## Core Architectural Shift

Instead of treating provenance as local editor metadata, we treat it as:

> A first-class, relational, queryable attribution graph stored in the database.

The editor references provenance records by ID.

---

# 2. Identity-First Model

Since this is cloud-based:

Every attribution is tied to:

- A verified user (author)
- Or a declared external source
- Or a declared AI system

This enables:

- Public author profiles
- Traceability
- Cross-document attribution graphs
- Source-side tracking dashboards

---

# 3. Core Data Model (Drizzle / SQL)

## Users

```
users
- id
- name
- email
- publicKey (optional for signing)
- createdAt
```

## Documents

```
documents
- id
- ownerId
- title
- content (JSON – Tiptap doc)
- createdAt
- updatedAt
```

## Provenance Records

Canonical attribution objects stored centrally:

```
provenance_records
- id (prov_xxx)
- sourceType (human | ai | external | unknown)
- authorUserId (nullable FK users)
- authorName (string fallback)
- sourceUrl
- sourceDocumentId (nullable FK documents)
- aiModelName
- originalHash
- createdByUserId
- createdAt
```

## Span References

Instead of embedding full provenance in editor content, we store:

```
span_attributions
- id
- documentId
- provenanceId
- startOffset
- endOffset
- spanHash
```

The Tiptap mark only contains `provenanceId`.

This allows:

- Rebuilding attribution graph server-side
- Querying: "Where has this source been reused?"

---

# 4. Tiptap Implementation (Cloud-Aware)

## Custom Mark: Attribution

Mark attributes:

- provenanceId

HTML serialization:

```
<span data-prov-id="prov_abc123" class="prov prov-human">Text</span>
```

On save:

- Editor JSON is stored in `documents.content`
- Span positions extracted and synced to `span_attributions`

---

# 5. Attribution Visualization (Primary UX Goal)

This POC should feel visually striking.

### Styling Modes

- 🔴 Human original author → red underline
- 🟣 AI generated → dashed underline + AI badge
- 🔵 External source → blue left border or quote styling
- ⚪ Unattributed → yellow highlight until resolved

### Attribution Inspector Panel

Click a span → shows:

- Author (linked profile)
- Source document
- Source URL
- "View all uses of this content"
- Provenance chain

---

# 6. The Source ↔ Destination Handshake Model (Key Innovation)

This is the most important conceptual addition.

## Problem

Current attribution is one-directional:

Destination cites source.
Source has no awareness.

## Proposed Model

When content is reused:

1. Destination creates a provenance record referencing source document or author.
2. System generates a "reuse event".
3. Source receives a notification or dashboard entry.
4. Optional: source cryptographically acknowledges.

---

## New Tables

### Reuse Events

```
reuse_events
- id
- sourceProvenanceId
- sourceDocumentId
- destinationDocumentId
- destinationUserId
- timestamp
- acknowledged (boolean)
- acknowledgementSignature
```
```

This enables:

- "Your content was reused 12 times"
- Attribution analytics
- Public reuse graphs

---

# 7. Clipboard Flow (Cloud POC Simplified)

For now (web-first):

### On Copy

- Serialize HTML with `data-prov-id`
- Add custom MIME: `application/x-attribution+json`
  - Include provenance IDs + minimal metadata

### On Paste

1. If provenance IDs belong to this system:
   - Verify against DB
   - Create reuse_event
2. If unknown external system:
   - Prompt user
   - Create new provenance record

---

# 8. Attribution Graph (Public Showcase Feature)

Because this is broad-audience:

Each provenance record gets a public page:

```
/provenance/prov_xxx
```

Shows:

- Original author
- Source document
- Derivation tree
- All reuse events
- Timeline visualization

This demonstrates:

> "Attribution as a living network"

---

# 9. C2PA Positioning (Phase 3+)

For now:

We model provenance in a way that can later map to C2PA assertions.

When exporting:

- Bundle document
- Bundle provenance graph subset
- Generate signed manifest (server-side for POC)

The handshake model could be proposed as:

> A bidirectional extension to C2PA claims allowing reuse acknowledgment assertions.

---

# 10. Updated Phased Roadmap

## Phase 1 — Auth + Editor + Basic Attribution (3–4 weeks)

- Next.js app deployed to Vercel
- BetterAuth login
- Drizzle schema + migrations
- Tiptap editor with Attribution mark
- Save document + provenance records
- Basic attribution visualization

Goal: Users can create attributed documents.

---

## Phase 2 — Reuse Tracking + Handshake (3–4 weeks)

- Implement reuse_events table
- Detect provenance reuse on paste
- Create reuse event
- Add source dashboard
- Add notification system

Goal: Source can see reuse.

---

## Phase 3 — Public Attribution Graph (2–3 weeks)

- Public provenance pages
- Visualization of derivation chains
- "View where used" pages

Goal: Showcase network effect.

---

## Phase 4 — Signing & C2PA Export (2–3 weeks)

- Server-side signing
- Manifest generation
- Export flow

---

# 11. Key Architectural Decisions to Confirm

1. Should documents default to public or private?
2. Should provenance records be public by default?
3. Should reuse require explicit permission from source?
4. Do we allow anonymous attribution?
5. Should handshake acknowledgment be required before export?
6. Do you want author identity verified (e.g., email domain validation, social login)?
7. Should AI attribution include model + prompt hash?

---

# 12. Why This Cloud-First Approach Is Stronger for a POC

- Demonstrates network effects
- Shows attribution graph value immediately
- Enables reuse analytics
- Supports real identity
- Makes handshake concept concrete
- Easier to evangelize than local-only editor

Later, we can reintroduce Yjs for:

- Real-time collaboration
- Local-first editing
- Offline support

But provenance + identity must come first.

---

# Next Step

If you'd like, I can now:

1. Design the exact Drizzle schema (with TypeScript types)
2. Draft the Attribution Tiptap mark tailored for this cloud model
3. Design the handshake protocol in detail (API-level flow)
4. Sketch the public attribution graph UI

Tell me which layer you want to design first.

