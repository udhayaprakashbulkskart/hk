import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import type { Container } from "./container";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./common/http-error.filter";
import { buildOpenApi } from "./openapi";

export async function createApp(container: Container) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(container), {
    logger: false,
    bodyParser: false,
  });
  const http = app.getHttpAdapter().getInstance() as express.Express;
  http.set("trust proxy", container.config.trustProxyHops);
  http.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger: container.logger,
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id = typeof incoming === "string" && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url?.split("?")[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      strictTransportSecurity: container.config.appEnv === "production" ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    }),
  );
  app.enableCors({
    origin: container.config.corsOrigins.length ? container.config.corsOrigins : false,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    maxAge: 600,
  });
  app.useBodyParser("json", { limit: "16kb" });
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new HttpErrorFilter());

  if (container.config.openapiEnabled) {
    const doc = buildOpenApi();
    http.get("/v1/openapi.json", (_req, res) => res.json(doc));
  }
  return app;
}
