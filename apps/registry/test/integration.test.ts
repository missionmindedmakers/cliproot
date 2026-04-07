import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestApp, cleanupTestApp, makeTestBundle } from "./helpers.js";

describe("CRP Registry Integration", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>["app"];
  let tmpDir: string;

  beforeAll(async () => {
    const testEnv = await createTestApp();
    app = testEnv.app;
    tmpDir = testEnv.tmpDir;
  });

  afterAll(() => {
    cleanupTestApp(tmpDir);
  });

  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("GET /v1/index/config.json returns registry config", async () => {
    const res = await app.request("/v1/index/config.json");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registryVersion).toBe("1");
    expect(body.api).toContain("/v1/api");
    expect(body.download).toContain("/v1/download");
    expect(body.authRequired).toBe(false);
  });

  it("GET /v1/index/projects returns empty list initially", async () => {
    const res = await app.request("/v1/index/projects");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projects).toEqual([]);
    expect(body.cursor).toBeNull();
  });

  describe("POST /v1/api/clips — publish bundles", () => {
    const bundle = makeTestBundle({
      clipContent: "OAuth PKCE flow implementation",
      clipCount: 3,
      withEdges: true,
    });

    it("publishes bundles and returns 201", async () => {
      const res = await app.request("/v1/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: "alice",
          project: "auth-refactor",
          bundles: [bundle],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.owner).toBe("alice");
      expect(body.project).toBe("auth-refactor");
      expect(body.accepted).toBe(3);
      expect(body.clipHashes).toHaveLength(3);
    });

    it("GET /v1/index/projects lists the project", async () => {
      const res = await app.request("/v1/index/projects");
      const body = await res.json();
      expect(body.projects).toHaveLength(1);
      expect(body.projects[0].owner).toBe("alice");
      expect(body.projects[0].name).toBe("auth-refactor");
      expect(body.projects[0].clipCount).toBe(3);
    });

    it("GET /v1/index/projects/:owner/:name returns project detail", async () => {
      const res = await app.request(
        "/v1/index/projects/alice/auth-refactor",
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.owner).toBe("alice");
      expect(body.clipCount).toBe(3);
      expect(body.edgeCount).toBe(2);
    });

    it("GET /v1/index/clips/:hash returns clip detail", async () => {
      const clipHash = bundle.clips![0]!.clipHash;
      const res = await app.request(`/v1/index/clips/${clipHash}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.clipHash).toBe(clipHash);
      expect(body.project.owner).toBe("alice");
      expect(body.sourceRefs).toHaveLength(1);
    });

    it("GET /v1/index/clips/:hash/lineage returns ancestor chain", async () => {
      // Last clip has derivation edges back to first
      const lastClip = bundle.clips![2]!;
      const res = await app.request(
        `/v1/index/clips/${lastClip.clipHash}/lineage`,
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.root).toBe(lastClip.clipHash);
      expect(body.clips.length).toBeGreaterThanOrEqual(2);
    });

    it("GET /v1/download/clips/:hash.json returns bundle JSON", async () => {
      // The bundle is stored by bundle hash, need to look up via clip detail
      const clipHash = bundle.clips![0]!.clipHash;
      const clipRes = await app.request(`/v1/index/clips/${clipHash}`);
      const clipBody = await clipRes.json();
      const bundleHash = clipBody.bundleHash;

      const res = await app.request(
        `/v1/download/clips/${bundleHash}.json`,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toContain("immutable");
      expect(res.headers.get("etag")).toBe(`"${bundleHash}"`);
    });

    it("GET /v1/api/search finds clips by content", async () => {
      const res = await app.request("/v1/api/search?q=OAuth+PKCE");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.total).toBeGreaterThan(0);
    });

    it("GET /v1/api/search with owner filter", async () => {
      const res = await app.request(
        "/v1/api/search?q=OAuth&owner=alice",
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results.length).toBeGreaterThan(0);
      for (const result of body.results) {
        expect(result.project.owner).toBe("alice");
      }
    });
  });

  describe("Error handling", () => {
    it("GET /v1/index/clips/invalid-hash returns 400", async () => {
      const res = await app.request("/v1/index/clips/not-a-hash");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("invalid_hash");
    });

    it("GET /v1/index/clips/sha256-nonexistent returns 404", async () => {
      const res = await app.request("/v1/index/clips/sha256-nonexistent");
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("not_found");
    });

    it("GET /v1/index/projects/nobody/nothing returns 404", async () => {
      const res = await app.request("/v1/index/projects/nobody/nothing");
      expect(res.status).toBe(404);
    });

    it("POST /v1/api/negotiate returns 501", async () => {
      const res = await app.request("/v1/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      expect(res.status).toBe(501);
    });

    it("GET /v1/download/packs/sha256-missing.cliprootpack returns 404", async () => {
      const res = await app.request(
        "/v1/download/packs/sha256-missing.cliprootpack",
      );
      expect(res.status).toBe(404);
    });

    it("GET /v1/api/search without q returns 400", async () => {
      const res = await app.request("/v1/api/search");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("missing_query");
    });
  });

  describe("ETag caching", () => {
    it("returns 304 on matching If-None-Match", async () => {
      const res1 = await app.request("/v1/index/config.json");
      const etag = res1.headers.get("etag")!;
      expect(etag).toBeTruthy();

      const res2 = await app.request("/v1/index/config.json", {
        headers: { "If-None-Match": etag },
      });
      expect(res2.status).toBe(304);
    });
  });
});
