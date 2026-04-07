import type { CrpBundle } from "@cliproot/protocol";
import type { TokenStorage } from "./token-storage.js";
import {
  RegistryError,
  RegistryAuthError,
  RegistryNotFoundError,
} from "./errors.js";
import { checkSession } from "./auth.js";
import type {
  RegistryIndexConfig,
  PublishClipsRequest,
  PublishClipsResult,
  PublishPackResult,
  ProjectSummary,
  ProjectDetail,
  ClipDetail,
  LineageResponse,
  SearchResult,
  SearchParams,
  ListProjectsParams,
  SessionInfo,
} from "./types.js";

export interface RegistryClientOptions {
  tokenStore: TokenStorage;
  fetch?: typeof fetch;
}

interface CacheEntry {
  etag: string;
  body: unknown;
}

export class RegistryClient {
  private readonly tokenStore: TokenStorage;
  private readonly fetchFn: typeof fetch;
  private readonly etagCache = new Map<string, CacheEntry>();
  private baseUrl: string | null = null;

  constructor(options: RegistryClientOptions) {
    this.tokenStore = options.tokenStore;
    this.fetchFn = options.fetch ?? fetch;
  }

  // ── Connection ──────────────────────────────────────────────

  async connect(registryUrl: string): Promise<RegistryIndexConfig> {
    const url = registryUrl.replace(/\/+$/, "");
    const config = await this.fetchJson<RegistryIndexConfig>(
      `${url}/v1/index/config.json`,
    );
    this.baseUrl = url;
    await this.tokenStore.setRegistryUrl(url);
    return config;
  }

  async disconnect(): Promise<void> {
    this.baseUrl = null;
    this.etagCache.clear();
    await this.tokenStore.setRegistryUrl(null);
    await this.tokenStore.setToken(null);
  }

  async isConnected(): Promise<boolean> {
    const url = await this.ensureBaseUrl(false);
    return url !== null;
  }

  // ── Layer 1: Index ──────────────────────────────────────────

  async getConfig(): Promise<RegistryIndexConfig> {
    const base = await this.ensureBaseUrl();
    return this.fetchJson<RegistryIndexConfig>(
      `${base}/v1/index/config.json`,
    );
  }

  async listProjects(
    params?: ListProjectsParams,
  ): Promise<{ projects: ProjectSummary[]; cursor: string | null }> {
    const base = await this.ensureBaseUrl();
    const qs = new URLSearchParams();
    if (params?.owner) qs.set("owner", params.owner);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.cursor) qs.set("cursor", params.cursor);
    const query = qs.toString();
    const url = `${base}/v1/index/projects${query ? `?${query}` : ""}`;
    const data = await this.fetchJson<{
      projects: ProjectSummary[];
      cursor: string | null;
    }>(url);
    return data;
  }

  async getProject(owner: string, name: string): Promise<ProjectDetail> {
    const base = await this.ensureBaseUrl();
    return this.fetchJson<ProjectDetail>(
      `${base}/v1/index/projects/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    );
  }

  async getClip(hash: string): Promise<ClipDetail> {
    const base = await this.ensureBaseUrl();
    return this.fetchJson<ClipDetail>(
      `${base}/v1/index/clips/${encodeURIComponent(hash)}`,
    );
  }

  async getLineage(
    hash: string,
    depth?: number,
  ): Promise<LineageResponse> {
    const base = await this.ensureBaseUrl();
    const qs = depth !== undefined ? `?depth=${depth}` : "";
    return this.fetchJson<LineageResponse>(
      `${base}/v1/index/clips/${encodeURIComponent(hash)}/lineage${qs}`,
    );
  }

  // ── Layer 2: Download ───────────────────────────────────────

  async downloadClipBundle(hash: string): Promise<CrpBundle> {
    const base = await this.ensureBaseUrl();
    return this.fetchJson<CrpBundle>(
      `${base}/v1/download/clips/${encodeURIComponent(hash)}.json`,
    );
  }

  async downloadPack(hash: string): Promise<ArrayBuffer> {
    const base = await this.ensureBaseUrl();
    const res = await this.rawFetch(
      `${base}/v1/download/packs/${encodeURIComponent(hash)}.cliprootpack`,
    );
    return res.arrayBuffer();
  }

  async downloadArtifact(hash: string): Promise<ArrayBuffer> {
    const base = await this.ensureBaseUrl();
    const res = await this.rawFetch(
      `${base}/v1/download/artifacts/${encodeURIComponent(hash)}`,
    );
    return res.arrayBuffer();
  }

  // ── Layer 3: API (Write + Search) ──────────────────────────

  async publishClips(
    request: PublishClipsRequest,
  ): Promise<PublishClipsResult> {
    const base = await this.ensureBaseUrl();
    const token = await this.tokenStore.getToken();
    if (!token) throw new RegistryAuthError();

    const res = await this.fetchFn(`${base}/v1/api/clips`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    await this.throwOnError(res);
    return (await res.json()) as PublishClipsResult;
  }

  async publishPack(data: ArrayBuffer): Promise<PublishPackResult> {
    const base = await this.ensureBaseUrl();
    const token = await this.tokenStore.getToken();
    if (!token) throw new RegistryAuthError();

    const res = await this.fetchFn(`${base}/v1/api/packs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-cliprootpack",
        Authorization: `Bearer ${token}`,
      },
      body: data,
    });

    await this.throwOnError(res);
    return (await res.json()) as PublishPackResult;
  }

  async search(
    params: SearchParams,
  ): Promise<{ results: SearchResult[]; cursor: string | null; total: number }> {
    const base = await this.ensureBaseUrl();
    const qs = new URLSearchParams({ q: params.q });
    if (params.owner) qs.set("owner", params.owner);
    if (params.project) qs.set("project", params.project);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);

    return this.fetchJson<{
      results: SearchResult[];
      cursor: string | null;
      total: number;
    }>(`${base}/v1/api/search?${qs.toString()}`);
  }

  // ── Auth ────────────────────────────────────────────────────

  async checkAuth(): Promise<SessionInfo> {
    const url = await this.ensureBaseUrl(false);
    const token = await this.tokenStore.getToken();
    if (!url || !token) return { valid: false };
    return checkSession(url, token, this.fetchFn);
  }

  async logout(): Promise<void> {
    await this.tokenStore.setToken(null);
  }

  // ── Internals ───────────────────────────────────────────────

  private async ensureBaseUrl(throwIfMissing?: true): Promise<string>;
  private async ensureBaseUrl(
    throwIfMissing: false,
  ): Promise<string | null>;
  private async ensureBaseUrl(
    throwIfMissing = true,
  ): Promise<string | null> {
    if (this.baseUrl) return this.baseUrl;
    const stored = await this.tokenStore.getRegistryUrl();
    if (stored) {
      this.baseUrl = stored;
      return stored;
    }
    if (throwIfMissing) {
      throw new RegistryError(
        "Not connected to a registry. Call connect() first.",
        0,
        "NOT_CONNECTED",
      );
    }
    return null;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {};
    const token = await this.tokenStore.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const cached = this.etagCache.get(url);
    if (cached) headers["If-None-Match"] = cached.etag;

    const res = await this.fetchFn(url, { headers });

    if (res.status === 304 && cached) {
      return cached.body as T;
    }

    await this.throwOnError(res);

    const body = (await res.json()) as T;
    const etag = res.headers.get("ETag");
    if (etag) {
      this.etagCache.set(url, { etag, body });
    }

    return body;
  }

  private async rawFetch(url: string): Promise<Response> {
    const headers: Record<string, string> = {};
    const token = await this.tokenStore.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await this.fetchFn(url, { headers });
    await this.throwOnError(res);
    return res;
  }

  private async throwOnError(res: Response): Promise<void> {
    if (res.ok) return;

    let message = res.statusText;
    let code = "UNKNOWN";
    let details: unknown;

    try {
      const body = (await res.json()) as {
        error?: string;
        code?: string;
        details?: unknown;
      };
      message = body.error ?? message;
      code = body.code ?? code;
      details = body.details;
    } catch {
      // body wasn't JSON — use statusText
    }

    if (res.status === 401) throw new RegistryAuthError(message, details);
    if (res.status === 404)
      throw new RegistryNotFoundError(message, details);
    throw new RegistryError(message, res.status, code, details);
  }
}
