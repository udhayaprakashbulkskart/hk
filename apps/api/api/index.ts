import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "../src/config";
import { createContainer } from "../src/container";
import { createApp } from "../src/app";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Vercel entry point. The Nest application is built once per instance (module scope) and then every request is
 * handed to its Express adapter. Live updates and background notifications need Redis and are not served here.
 */
let ready: Promise<Handler> | null = null;

function boot(): Promise<Handler> {
  if (!ready) {
    ready = (async () => {
      const config = loadConfig();
      const container = createContainer(config);
      if (config.loginUser) {
        const r = await container.auth.provisionLoginUser({ ...config.loginUser, countryCode: "HK", language: "en" });
        container.logger.info({ created: r.created }, "login user ready");
      }
      const app = await createApp(container);
      await app.init();
      return app.getHttpAdapter().getInstance() as Handler;
    })();
    // A failed boot must not be cached: the next request tries again.
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const express = await boot();
  express(req, res);
}
