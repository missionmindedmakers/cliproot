export interface ClipCapturedMessage {
  type: 'clip-captured'
  hostname: string
  url: string
  title: string
  textPreview: string
  textHash: string
  fullText: string
  bundleJson: string | null
  /** JSON-serialised selectors from CapturedSelection, for highlight re-anchoring. */
  selectorsJson: string | null
}

export interface GetPageClipsRequest {
  type: 'get-page-clips'
  url: string
}

export interface GetPageClipsResponse {
  clips: StoredClip[]
}

export interface PasteDetectedMessage {
  type: 'paste-detected'
  hostname: string
  url: string
  title: string
  textPreview: string
  textHash: string
  bundleJson: string | null
}

export interface StoredDocument {
  id: string
  uri: string
  title: string
}

export interface StoredClip {
  clipHash: string
  projectId?: string
  documentId: string
  sourceRefs: string[]
  textHash: string
  content: string
  selectors?: {
    textQuote?: { exact: string; prefix?: string; suffix?: string }
    textPosition?: { start: number; end: number }
    dom?: Record<string, string>
    parentClipHash?: string
  }
  createdAt: string
  bundleJson: string | null
}

export interface StoredEdge {
  id: string
  edgeType: string
  subjectRef: string
  objectRef: string
  transformationType?: string
  agentId?: string
  confidence?: number
  createdAt: string
}

export interface StoredActivity {
  id: string
  activityType: string
  projectId?: string
  agentId?: string
  createdAt: string
  endedAt?: string
}

export interface RecentClip {
  url: string
  hostname: string
  title: string
  timestamp: number
  textPreview: string
}

export type SiteSettings = Record<string, boolean | 'default'>

export interface GetPageSourcesRequest {
  type: 'get-page-sources'
  url: string
}

export interface PageSource {
  hostname: string
  url: string
  title: string
  clipCount: number
  clips: Array<{ clipHash: string; textPreview: string; timestamp: number }>
}

export interface GetPageSourcesResponse {
  sources: PageSource[]
}

export interface GenerateBibliographyRequest {
  type: 'generate-bibliography'
  url: string
  format: 'markdown' | 'numbered' | 'plain'
}

export interface GenerateBibliographyResponse {
  text: string
  sourceCount: number
}

export interface GetClipDetailRequest {
  type: 'get-clip-detail'
  clipHash: string
}

export interface GetClipDetailResponse {
  clip: StoredClip | null
  edges: StoredEdge[]
}

export interface SearchClipsRequest {
  type: 'search-clips'
  query: string
}

export interface SearchClipsResponse {
  clips: StoredClip[]
}

// ── Registry messages ──

export interface RegistryConnectRequest {
  type: 'registry-connect'
  url: string
}

export interface RegistryDisconnectRequest {
  type: 'registry-disconnect'
}

export interface RegistryLoginRequest {
  type: 'registry-login'
}

export interface RegistryPublishClipsRequest {
  type: 'registry-publish-clips'
  project: string
}

export interface RegistryStatusRequest {
  type: 'registry-status'
}

export interface RegistryStatusResponse {
  connected: boolean
  registryUrl: string | null
  user: { id: string; name: string; email: string } | null
  autoSync: boolean
}

export interface RegistrySyncRequest {
  type: 'registry-sync'
  project?: string
}
