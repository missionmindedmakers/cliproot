import { Hono } from "hono";
import type { AppContext } from "../app.js";
import { createLayer1Routes } from "./layer1-index.js";
import { createLayer2Routes } from "./layer2-download.js";
import { createLayer3Routes } from "./layer3-api.js";
import { createAuthRoutes } from "./auth.js";

export function createRoutes(ctx: AppContext) {
  const routes = new Hono();

  routes.route("/", createAuthRoutes(ctx));
  routes.route("/", createLayer1Routes(ctx));
  routes.route("/", createLayer2Routes(ctx));
  routes.route("/", createLayer3Routes(ctx));

  return routes;
}
