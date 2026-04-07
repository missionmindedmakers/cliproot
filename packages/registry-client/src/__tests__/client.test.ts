import { describe, it, expect, beforeEach, vi } from "vitest";
import { RegistryClient } from "../client.js";
import { MemoryTokenStore } from "../token-storage.js";
import { RegistryAuthError, RegistryNotFoundError } from "../errors.js";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

describe("RegistryClient", () => {
  let store: MemoryTokenStore;
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: RegistryClient;

  beforeEach(() => {
    store = new MemoryTokenStore();
    mockFetch = vi.fn();
    client = new RegistryClient({ tokenStore: store, fetch: mockFetch });
  });

  describe("connect / disconnect", () => {
    it("fetches config.json and stores the URL", async () => {
      const config = {
        registryVersion: "1",
        api: "http://localhost:3000/v1",
        download: "http://localhost:3000/v1",
        index: "http://localhost:3000/v1",
        authRequired: false,
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(config));

      const result = await client.connect("http://localhost:3000");
      expect(result).toEqual(config);
      expect(await store.getRegistryUrl()).toBe("http://localhost:3000");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/v1/index/config.json",
        expect.any(Object),
      );
    });

    it("clears state on disconnect", async () => {
      await store.setRegistryUrl("http://localhost:3000");
      await store.setToken("tok_abc");
      await client.disconnect();
      expect(await store.getRegistryUrl()).toBeNull();
      expect(await store.getToken()).toBeNull();
    });

    it("reports connection status", async () => {
      expect(await client.isConnected()).toBe(false);
      await store.setRegistryUrl("http://localhost:3000");
      expect(await client.isConnected()).toBe(true);
    });
  });

  describe("Layer 1: Index", () => {
    beforeEach(async () => {
      await store.setRegistryUrl("http://localhost:3000");
    });

    it("lists projects", async () => {
      const body = {
        projects: [
          {
            owner: "alice",
            name: "proj",
            clipCount: 5,
            lastPublishedAt: "2026-01-01T00:00:00Z",
          },
        ],
        cursor: null,
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(body));

      const result = await client.listProjects({ owner: "alice" });
      expect(result.projects).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/v1/index/projects?owner=alice",
        expect.any(Object),
      );
    });

    it("gets project detail", async () => {
      const detail = {
        owner: "alice",
        name: "proj",
        description: null,
        clipCount: 5,
        edgeCount: 2,
        artifactCount: 1,
        lastPublishedAt: "2026-01-01T00:00:00Z",
        latestPackHash: null,
        createdAt: "2025-12-01T00:00:00Z",
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(detail));

      const result = await client.getProject("alice", "proj");
      expect(result.owner).toBe("alice");
    });

    it("gets clip detail", async () => {
      const clip = {
        clipHash: "sha256-abc",
        textHash: "sha256-def",
        content: "hello",
        sourceRefs: [],
        project: { owner: "alice", name: "proj" },
        edges: [],
        bundleHash: "sha256-ghi",
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(clip));

      const result = await client.getClip("sha256-abc");
      expect(result.clipHash).toBe("sha256-abc");
    });

    it("gets lineage", async () => {
      const lineage = {
        root: "sha256-abc",
        clips: [],
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(lineage));

      const result = await client.getLineage("sha256-abc", 3);
      expect(result.root).toBe("sha256-abc");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/v1/index/clips/sha256-abc/lineage?depth=3",
        expect.any(Object),
      );
    });
  });

  describe("Layer 2: Download", () => {
    beforeEach(async () => {
      await store.setRegistryUrl("http://localhost:3000");
    });

    it("downloads a clip bundle as JSON", async () => {
      const bundle = { protocolVersion: "0.0.3", bundleType: "clipboard" };
      mockFetch.mockResolvedValueOnce(jsonResponse(bundle));

      const result = await client.downloadClipBundle("sha256-abc");
      expect(result).toEqual(bundle);
    });
  });

  describe("Layer 3: API", () => {
    beforeEach(async () => {
      await store.setRegistryUrl("http://localhost:3000");
      await store.setToken("tok_abc");
    });

    it("publishes clips", async () => {
      const publishResult = {
        owner: "alice",
        project: "proj",
        accepted: 1,
        clipHashes: ["sha256-abc"],
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(publishResult, { status: 201 }));

      const result = await client.publishClips({
        project: "proj",
        bundles: [] as never[],
      });
      expect(result.accepted).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/v1/api/clips",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws RegistryAuthError without a token", async () => {
      await store.setToken(null);
      await expect(
        client.publishClips({ project: "proj", bundles: [] as never[] }),
      ).rejects.toThrow(RegistryAuthError);
    });

    it("searches clips", async () => {
      const searchBody = {
        results: [
          {
            clipHash: "sha256-abc",
            content: "test",
            project: { owner: "alice", name: "proj" },
            score: 1.0,
          },
        ],
        cursor: null,
        total: 1,
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(searchBody));

      const result = await client.search({ q: "test" });
      expect(result.results).toHaveLength(1);
    });
  });

  describe("Error handling", () => {
    beforeEach(async () => {
      await store.setRegistryUrl("http://localhost:3000");
    });

    it("throws RegistryNotFoundError on 404", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "Not found", code: "NOT_FOUND" }, { status: 404 }),
      );
      await expect(client.getClip("sha256-missing")).rejects.toThrow(
        RegistryNotFoundError,
      );
    });

    it("throws RegistryAuthError on 401", async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ error: "Unauthorized" }, { status: 401 }),
      );
      await expect(client.getClip("sha256-abc")).rejects.toThrow(
        RegistryAuthError,
      );
    });
  });

  describe("ETag caching", () => {
    beforeEach(async () => {
      await store.setRegistryUrl("http://localhost:3000");
    });

    it("caches responses by ETag and returns cached on 304", async () => {
      const body = { clipHash: "sha256-abc" };
      const headers = new Headers({
        "Content-Type": "application/json",
        ETag: '"v1"',
      });
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(body), { status: 200, headers }),
      );

      const first = await client.getClip("sha256-abc");
      expect(first).toEqual(body);

      // Second call should send If-None-Match
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 304 }),
      );

      const second = await client.getClip("sha256-abc");
      expect(second).toEqual(body);

      const secondCall = mockFetch.mock.calls[1]!;
      expect(secondCall[1].headers["If-None-Match"]).toBe('"v1"');
    });
  });
});
