import type { CrpBundle } from "@cliproot/protocol";

// ---------- Response types (mirror apps/registry/src/types.ts) ----------

export interface PublishPackResult {
  packHash: string;
  owner: string;
  project: string;
  clips: number;
  artifacts: number;
  edges: number;
  url: string;
}

export interface PublishClipsResult {
  owner: string;
  project: string;
  accepted: number;
  clipHashes: string[];
}

export interface ProjectSummary {
  owner: string;
  name: string;
  clipCount: number;
  lastPublishedAt: string;
}

export interface ProjectDetail {
  owner: string;
  name: string;
  description: string | null;
  clipCount: number;
  edgeCount: number;
  artifactCount: number;
  lastPublishedAt: string;
  latestPackHash: string | null;
  createdAt: string;
}

export interface ClipDetail {
  clipHash: string;
  textHash: string;
  content: string | null;
  sourceRefs: string[];
  project: { owner: string; name: string };
  edges: Array<{
    type: string;
    subjectRef: string;
    objectRef: string;
  }>;
  bundleHash: string;
}

export interface LineageClip {
  clipHash: string;
  textHash: string;
  content: string | null;
  sourceRefs: string[];
  derivedFrom: string[];
}

export interface LineageResponse {
  root: string;
  clips: LineageClip[];
}

export interface SearchResult {
  clipHash: string;
  content: string;
  project: { owner: string; name: string };
  score: number;
}

// ---------- Client-specific types ----------

export interface RegistryIndexConfig {
  registryVersion: string;
  api: string;
  download: string;
  index: string;
  authRequired: boolean;
  authUrl?: string;
}

export interface PublishClipsRequest {
  owner?: string;
  project: string;
  bundles: CrpBundle[];
}

export interface SearchParams {
  q: string;
  owner?: string;
  project?: string;
  limit?: number;
  cursor?: string;
}

export interface ListProjectsParams {
  owner?: string;
  limit?: number;
  cursor?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface SessionInfo {
  valid: boolean;
  user?: SessionUser;
}
