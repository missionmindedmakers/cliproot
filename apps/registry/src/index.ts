import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

createApp({ config }).then((app) => {
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(
      `CRP Registry server listening on http://localhost:${info.port}`,
    );
  });
});
