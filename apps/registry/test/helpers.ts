import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CrpBundle } from "@cliproot/protocol";
import { createTextHash, createClipHash } from "@cliproot/protocol";
import { createApp, type AppContext } from "../src/app.js";
import type { RegistryConfig } from "../src/config.js";

export function createTestConfig(
  tmpDir: string,
  overrides?: Partial<RegistryConfig>,
): RegistryConfig {
  return {
    port: 0,
    dataDir: tmpDir,
    databasePath: path.join(tmpDir, "test.db"),
    baseUrl: "http://localhost:3002",
    defaultOwner: "testowner",
    maxPackSize: 100 * 1024 * 1024,
    authRequired: false,
    authSecret: "test-secret-at-least-32-characters-long",
    googleClientId: "",
    googleClientSecret: "",
    deviceCodeTtl: 900,
    devicePollInterval: 5,
    ...overrides,
  };
}

export async function createTestApp(
  configOverrides?: Partial<RegistryConfig>,
) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "crp-registry-test-"));
  const config = createTestConfig(tmpDir, configOverrides);
  const app = await createApp({ config });
  return { app, config, tmpDir };
}

export function cleanupTestApp(tmpDir: string) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

export function makeTestBundle(opts?: {
  clipContent?: string;
  clipCount?: number;
  withEdges?: boolean;
  withArtifacts?: boolean;
}): CrpBundle {
  const content = opts?.clipContent ?? "Test clip content for search.";
  const clipCount = opts?.clipCount ?? 1;

  const clips = [];
  const edges = [];
  const sourceId = "src_test_01";

  for (let i = 0; i < clipCount; i++) {
    const text = `${content} ${i}`;
    const textHash = createTextHash(text);
    const clipHash = createClipHash({
      textHash,
      sourceRefs: [sourceId],
    });

    clips.push({
      clipHash,
      textHash,
      content: text,
      sourceRefs: [sourceId],
      selectors: {
        textQuote: { exact: text },
      },
    });

    // Create derivation edges if there's a previous clip
    if (opts?.withEdges && i > 0) {
      const prevClip = clips[i - 1]!;
      edges.push({
        id: `edge_${i}`,
        edgeType: "wasDerivedFrom" as const,
        subjectRef: clipHash,
        objectRef: prevClip.clipHash,
        transformationType: "edit" as const,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const bundle: CrpBundle = {
    protocolVersion: "0.0.3",
    bundleType: "provenance-export",
    createdAt: new Date().toISOString(),
    sources: [
      {
        id: sourceId,
        sourceType: "human-authored",
        title: "Test Source",
      },
    ],
    clips,
    edges: edges.length > 0 ? edges : undefined,
  } as CrpBundle;

  return bundle;
}
