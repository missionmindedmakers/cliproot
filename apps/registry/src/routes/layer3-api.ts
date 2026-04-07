import { Hono } from "hono";
import type { AppContext } from "../app.js";
import { AppError } from "../middleware/error-handler.js";
import {
  indexBundles,
  validateAndParseBundle,
} from "../services/clip-service.js";
import { publishPack } from "../services/pack-service.js";
import { searchClips } from "../services/search-service.js";
import { encodeCursor, decodeCursor } from "../middleware/pagination.js";
import { requireAuth, getAuthUser } from "../middleware/auth.js";
import type { PublishClipsResult } from "../types.js";

export function createLayer3Routes(ctx: AppContext) {
  const routes = new Hono();

  // Apply auth middleware to all write endpoints
  const authMiddleware = requireAuth(ctx);

  // POST /v1/api/clips — Publish individual CRP bundles
  routes.post("/v1/api/clips", authMiddleware, async (c) => {
    const body = await c.req.json<{
      owner?: string;
      project: string;
      bundles: unknown[];
    }>();

    if (!body.project) {
      throw new AppError(400, "missing_project", "project is required");
    }
    if (!Array.isArray(body.bundles) || body.bundles.length === 0) {
      throw new AppError(400, "missing_bundles", "bundles array is required");
    }

    const owner = getAuthUser(c)?.name ?? body.owner ?? ctx.config.defaultOwner;
    const projectName = body.project;

    const validated = body.bundles.map(validateAndParseBundle);

    const result = indexBundles(ctx.db, ctx.blobStore, {
      owner,
      projectName,
      bundles: validated,
    });

    const response: PublishClipsResult = {
      owner,
      project: projectName,
      accepted: result.clipHashes.length,
      clipHashes: result.clipHashes,
    };

    return c.json(response, 201);
  });

  // POST /v1/api/packs — Publish a pack
  routes.post("/v1/api/packs", authMiddleware, async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    if (
      !contentType.includes("application/x-cliprootpack") &&
      !contentType.includes("application/octet-stream")
    ) {
      throw new AppError(
        400,
        "invalid_content_type",
        "Expected Content-Type: application/x-cliprootpack",
      );
    }

    const rawBytes = new Uint8Array(await c.req.arrayBuffer());
    if (rawBytes.length > ctx.config.maxPackSize) {
      throw new AppError(
        413,
        "pack_too_large",
        `Pack exceeds maximum size of ${ctx.config.maxPackSize} bytes`,
      );
    }

    const owner =
      getAuthUser(c)?.name ?? c.req.query("owner") ?? ctx.config.defaultOwner;

    const result = await publishPack(
      ctx.db,
      ctx.blobStore,
      rawBytes,
      owner,
      ctx.config.baseUrl,
    );

    return c.json(result, 201);
  });

  // GET /v1/api/search — Full-text search across published clips
  routes.get("/v1/api/search", (c) => {
    const query = c.req.query("q");
    if (!query) {
      throw new AppError(400, "missing_query", "q parameter is required");
    }

    const owner = c.req.query("owner");
    const project = c.req.query("project");
    const limit = Math.min(
      Math.max(parseInt(c.req.query("limit") ?? "20", 10) || 20, 1),
      100,
    );
    const cursorData = decodeCursor(c.req.query("cursor"));
    const offset = (cursorData?.["offset"] as number) ?? 0;

    const { results, total } = searchClips(ctx.db, {
      query,
      owner,
      project,
      limit,
      offset,
    });

    const nextOffset = offset + results.length;
    const nextCursor =
      nextOffset < total ? encodeCursor({ offset: nextOffset }) : null;

    return c.json({
      results,
      cursor: nextCursor,
      total,
    });
  });

  // POST /v1/api/negotiate — Reserved, not implemented in v1
  routes.post("/v1/api/negotiate", (c) => {
    return c.json(
      {
        error: {
          code: "not_implemented",
          message:
            "Delta negotiation is not implemented in v1 of the registry protocol.",
        },
      },
      501,
    );
  });

  return routes;
}
