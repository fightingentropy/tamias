/**
 * Worker/browser build: JSON logs only. No `pino-pretty` or `createRequire` — Cloudflare Vite
 * resolves `workerd` / `browser` first (see package.json `exports`), avoiding Miniflare module
 * fallback failures that surface as dropped requests / tRPC "Network connection lost".
 */
import pino from "pino";
import { createLoggerAdapter, loggerSerializers } from "./logger-shared";

function createBaseLogger(): pino.Logger {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    serializers: loggerSerializers,
  });
}

const baseLogger = createBaseLogger();

export const logger = createLoggerAdapter(baseLogger);

export function createLoggerWithContext(context: string) {
  const childLogger = baseLogger.child({ context });
  return createLoggerAdapter(childLogger, context);
}

export function setLogLevel(level: string) {
  baseLogger.level = level;
}

export default logger;
