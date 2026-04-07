import { Hono } from "hono";
import { eq, desc, and, lt, sql } from "drizzle-orm";
import type { AppContext } from "../app.js";
import * as schema from "../db/schema.js";
import { AppError } from "../middleware/error-handler.js";
import { handleEtag } from "../middleware/etag.js";
import { encodeCursor, decodeCursor } from "../middleware/pagination.js";
import { getLineage } from "../services/lineage-service.js";

const HASH_PATTERN = /^sha256-[A-Za-z0-9_-]+$/;

export function createLayer1Routes(ctx: AppContext) {
  const routes = new Hono();

  // GET /v1/index/config.json
  routes.get("/v1/index/config.json", (c) => {
    const base = ctx.config.baseUrl;
    const configBody: Record<string, unknown> = {
      registryVersion: "1",
      api: `${base}/v1/api`,
      download: `${base}/v1/download`,
      index: `${base}/v1/index`,
      authRequired: ctx.config.authRequired,
    };
    if (ctx.config.authRequired) {
      configBody.authUrl = `${base}/api/auth`;
    }
    const body = JSON.stringify(configBody);

    const cached = handleEtag(c, body);
    if (cached) return cached;

    c.header("Content-Type", "application/json");
    return c.body(body);
  });

  // GET /v1/index/projects
  routes.get("/v1/index/projects", (c) => {
    const ownerFilter = c.req.query("owner");
    const cursorParam = c.req.query("cursor");
    const limit = Math.min(
      Math.max(parseInt(c.req.query("limit") ?? "50", 10) || 50, 1),
      200,
    );

    const cursor = decodeCursor(cursorParam);
    const conditions = [];

    if (ownerFilter) {
      conditions.push(eq(schema.projects.owner, ownerFilter));
    }
    if (cursor) {
      const lastId = cursor["id"] as number;
      conditions.push(lt(schema.projects.id, lastId));
    }

    const where =
      conditions.length > 0 ? and(...conditions) : undefined;

    const rows = ctx.db
      .select({
        id: schema.projects.id,
        owner: schema.projects.owner,
        name: schema.projects.name,
        clipCount: schema.projects.clipCount,
        lastPublishedAt: schema.projects.lastPublishedAt,
      })
      .from(schema.projects)
      .where(where)
      .orderBy(desc(schema.projects.lastPublishedAt), desc(schema.projects.id))
      .limit(limit + 1)
      .all();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor({ id: items[items.length - 1]!.id })
        : null;

    const body = JSON.stringify({
      projects: items.map((r) => ({
        owner: r.owner,
        name: r.name,
        clipCount: r.clipCount,
        lastPublishedAt: r.lastPublishedAt,
      })),
      cursor: nextCursor,
    });

    const cached = handleEtag(c, body);
    if (cached) return cached;

    c.header("Content-Type", "application/json");
    return c.body(body);
  });

  // GET /v1/index/projects/:owner/:name
  routes.get("/v1/index/projects/:owner/:name", (c) => {
    const owner = c.req.param("owner");
    const name = c.req.param("name");

    const project = ctx.db
      .select()
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.owner, owner),
          eq(schema.projects.name, name),
        ),
      )
      .get();

    if (!project) {
      throw new AppError(404, "not_found", "Project not found");
    }

    const body = JSON.stringify({
      owner: project.owner,
      name: project.name,
      description: project.description,
      clipCount: project.clipCount,
      edgeCount: project.edgeCount,
      artifactCount: project.artifactCount,
      lastPublishedAt: project.lastPublishedAt,
      latestPackHash: project.latestPackHash,
      createdAt: project.createdAt,
    });

    const cached = handleEtag(c, body);
    if (cached) return cached;

    c.header("Content-Type", "application/json");
    return c.body(body);
  });

  // GET /v1/index/clips/:hash
  routes.get("/v1/index/clips/:hash", (c) => {
    const hash = c.req.param("hash");
    if (!HASH_PATTERN.test(hash)) {
      throw new AppError(400, "invalid_hash", `Invalid hash format: ${hash}`);
    }

    const clip = ctx.db
      .select()
      .from(schema.clips)
      .where(eq(schema.clips.clipHash, hash))
      .get();

    if (!clip) {
      throw new AppError(404, "not_found", "Clip not found");
    }

    const project = ctx.db
      .select({ owner: schema.projects.owner, name: schema.projects.name })
      .from(schema.projects)
      .where(eq(schema.projects.id, clip.projectId))
      .get()!;

    const edges = ctx.db
      .select({
        type: schema.edges.edgeType,
        subjectRef: schema.edges.subjectRef,
        objectRef: schema.edges.objectRef,
      })
      .from(schema.edges)
      .where(
        sql`${schema.edges.subjectRef} = ${hash} OR ${schema.edges.objectRef} = ${hash}`,
      )
      .all();

    const body = JSON.stringify({
      clipHash: clip.clipHash,
      textHash: clip.textHash,
      content: clip.content,
      sourceRefs: JSON.parse(clip.sourceRefs) as string[],
      project: { owner: project.owner, name: project.name },
      edges,
      bundleHash: clip.bundleHash,
    });

    const cached = handleEtag(c, body);
    if (cached) return cached;

    c.header("Content-Type", "application/json");
    return c.body(body);
  });

  // GET /v1/index/clips/:hash/lineage
  routes.get("/v1/index/clips/:hash/lineage", (c) => {
    const hash = c.req.param("hash");
    if (!HASH_PATTERN.test(hash)) {
      throw new AppError(400, "invalid_hash", `Invalid hash format: ${hash}`);
    }

    const depthParam = c.req.query("depth");
    const depth = depthParam ? parseInt(depthParam, 10) : undefined;

    const lineage = getLineage(ctx.db, hash, depth);
    if (!lineage) {
      throw new AppError(404, "not_found", "Clip not found");
    }

    const body = JSON.stringify(lineage);

    const cached = handleEtag(c, body);
    if (cached) return cached;

    c.header("Content-Type", "application/json");
    return c.body(body);
  });

  return routes;
}
