import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Response, Request } from "express";
import { AuthError } from "@hkfinhub/authentication";
import * as Sentry from "@sentry/node";
import { toHttp } from "./errors";

/**
 * Single place that shapes error responses: { error: { code, message } }.
 * Internal errors are logged with the request id and returned without details.
 */
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string; log?: { error: (o: object, m: string) => void } }>();

    if (exception instanceof AuthError) {
      const http = toHttp(exception);
      if (exception.retryAfterSeconds !== undefined) res.setHeader("Retry-After", String(exception.retryAfterSeconds));
      res.status(http.getStatus()).json({ error: http.getResponse() });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      // Our own errors carry a stable code. Anything else (parser or routing messages) gets a generic text,
      // so framework internals never reach the client.
      const coded = typeof body === "object" && body !== null && "code" in body;
      const payload = coded
        ? body
        : status === HttpStatus.NOT_FOUND
          ? { code: "NOT_FOUND", message: "No such endpoint." }
          : status >= 500
            ? { code: "INTERNAL", message: "Something went wrong. Please try again." }
            : { code: "BAD_REQUEST", message: "The request could not be understood." };
      res.status(status).json({ error: payload });
      return;
    }
    req.log?.error({ err: exception, requestId: req.id }, "unhandled error");
    if (Sentry.isInitialized()) Sentry.captureException(exception, { tags: { requestId: req.id ?? "" } });
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });
  }
}
