import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestApp,
  cleanupTestApp,
  makeTestBundle,
} from "./helpers.js";

describe("Auth — disabled (default)", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>["app"];
  let tmpDir: string;

  beforeAll(async () => {
    const testEnv = await createTestApp({ authRequired: false });
    app = testEnv.app;
    tmpDir = testEnv.tmpDir;
  });

  afterAll(() => cleanupTestApp(tmpDir));

  it("allows unauthenticated writes when authRequired is false", async () => {
    const bundle = makeTestBundle({ clipContent: "no-auth clip" });
    const res = await app.request("/v1/api/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: "anon",
        project: "test",
        bundles: [bundle],
      }),
    });
    expect(res.status).toBe(201);
  });

  it("config.json shows authRequired: false", async () => {
    const res = await app.request("/v1/index/config.json");
    const body = await res.json();
    expect(body.authRequired).toBe(false);
    expect(body.authUrl).toBeUndefined();
  });
});

describe("Auth — enabled", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>["app"];
  let tmpDir: string;
  let sessionToken: string;

  beforeAll(async () => {
    const testEnv = await createTestApp({
      authRequired: true,
      devicePollInterval: 1,
    });
    app = testEnv.app;
    tmpDir = testEnv.tmpDir;
  });

  afterAll(() => cleanupTestApp(tmpDir));

  it("config.json shows authRequired: true with authUrl", async () => {
    const res = await app.request("/v1/index/config.json");
    const body = await res.json();
    expect(body.authRequired).toBe(true);
    expect(body.authUrl).toContain("/api/auth");
  });

  it("rejects unauthenticated POST /v1/api/clips with 401", async () => {
    const bundle = makeTestBundle({ clipContent: "should fail" });
    const res = await app.request("/v1/api/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: "alice",
        project: "test",
        bundles: [bundle],
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("unauthorized");
  });

  it("rejects unauthenticated POST /v1/api/packs with 401", async () => {
    const res = await app.request("/v1/api/packs", {
      method: "POST",
      headers: { "Content-Type": "application/x-cliprootpack" },
      body: new Uint8Array([0]),
    });
    expect(res.status).toBe(401);
  });

  it("allows unauthenticated GET /v1/api/search (read is public)", async () => {
    const res = await app.request("/v1/api/search?q=test");
    expect(res.status).toBe(200);
  });

  it("allows unauthenticated GET /v1/index/projects (read is public)", async () => {
    const res = await app.request("/v1/index/projects");
    expect(res.status).toBe(200);
  });

  it("rejects invalid bearer token with 401", async () => {
    const bundle = makeTestBundle({ clipContent: "bad token" });
    const res = await app.request("/v1/api/clips", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-token-12345",
      },
      body: JSON.stringify({
        owner: "alice",
        project: "test",
        bundles: [bundle],
      }),
    });
    expect(res.status).toBe(401);
  });

  describe("BetterAuth sign-up and sign-in", () => {
    it("allows user registration via /api/auth/sign-up/email", async () => {
      const res = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alice Test",
          email: "alice@test.com",
          password: "password123456",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe("alice@test.com");
    });

    it("allows sign-in and returns session token", async () => {
      const res = await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alice@test.com",
          password: "password123456",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();

      // BetterAuth may return token in body or set-cookie header
      if (body.session?.token) {
        sessionToken = body.session.token;
      } else if (body.token) {
        sessionToken = body.token;
      } else {
        // Extract from set-cookie header
        const setCookie = res.headers.get("set-cookie") ?? "";
        const match = setCookie.match(
          /better-auth\.session_token=([^;]+)/,
        );
        expect(match).toBeTruthy();
        sessionToken = decodeURIComponent(match![1]!);
      }
      expect(sessionToken).toBeDefined();
    });

    it("allows authenticated POST /v1/api/clips with valid session token", async () => {
      const bundle = makeTestBundle({ clipContent: "authenticated clip" });
      const res = await app.request("/v1/api/clips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          project: "auth-test",
          bundles: [bundle],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      // Owner should be derived from the authenticated user's name
      expect(body.owner).toBe("Alice Test");
      expect(body.project).toBe("auth-test");
    });
  });

  describe("Device flow endpoints", () => {
    let deviceCode: string;
    let userCode: string;

    it("POST /api/auth/device/code initiates device flow", async () => {
      const res = await app.request("/api/auth/device/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: "cliproot-cli" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.device_code).toBeDefined();
      expect(body.user_code).toBeDefined();
      expect(body.verification_uri).toBeDefined();
      expect(body.expires_in).toBeGreaterThan(0);
      expect(body.interval).toBeGreaterThan(0);
      deviceCode = body.device_code;
      userCode = body.user_code;
    });

    it("POST /api/auth/device/token returns authorization_pending before approval", async () => {
      const res = await app.request("/api/auth/device/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: "cliproot-cli",
        }),
      });
      // BetterAuth returns 400 for authorization_pending per RFC 8628
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("authorization_pending");
    });

    it("POST /api/auth/device/approve requires authentication", async () => {
      const res = await app.request("/api/auth/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCode }),
      });
      // Should fail without session
      expect(res.status).toBe(401);
    });

    it("POST /api/auth/device/approve succeeds with session token", async () => {
      const res = await app.request("/api/auth/device/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ userCode }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("POST /api/auth/device/token returns access_token after approval", async () => {
      // Wait to avoid slow_down response from rate limiting (interval = 1s)
      await new Promise((r) => setTimeout(r, 1100));

      const res = await app.request("/api/auth/device/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: "cliproot-cli",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.access_token).toBeDefined();
      expect(body.token_type).toBe("Bearer");
      expect(body.expires_in).toBeGreaterThan(0);

      // The returned token should also work for authenticated requests
      const clipRes = await app.request("/v1/api/clips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${body.access_token}`,
        },
        body: JSON.stringify({
          project: "device-flow-test",
          bundles: [makeTestBundle({ clipContent: "device flow clip" })],
        }),
      });
      expect(clipRes.status).toBe(201);
    });
  });

  it("GET /device serves the verification HTML page", async () => {
    const res = await app.request("/device");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Device Authorization");
    expect(html).toContain("Authorize Device");
  });

  it("GET /device?user_code=ABCD1234 prefills the code", async () => {
    const res = await app.request("/device?user_code=ABCD1234");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('value="ABCD1234"');
  });
});
