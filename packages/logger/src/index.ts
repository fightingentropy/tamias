import { createRequire } from "node:module";
import pino from "pino";
import { createLoggerAdapter, loggerSerializers } from "./logger-shared";

/** True only in real Node/Bun — not in browsers or Cloudflare worker/miniflare bundles. */
const isNodeRuntime =
  typeof process !== "undefined" &&
  process.versions != null &&
  typeof process.versions.node === "string";

/**
 * Human-readable logs for local Node dev only (`NODE_ENV=development`).
 * The worker/browser entry (`workerd.ts`) skips this path entirely.
 */
const isPretty =
  isNodeRuntime &&
  process.env.LOG_PRETTY === "true" &&
  process.env.NODE_ENV === "development";

function createBaseLogger(): pino.Logger {
  const options = {
    level: process.env.LOG_LEVEL || "info",
    serializers: loggerSerializers,
  };

  if (!isPretty) {
    return pino(options);
  }

  const metaUrl = import.meta.url;
  if (typeof metaUrl !== "string" || metaUrl.length === 0) {
    return pino(options);
  }

  try {
    type PrettyFactory = (opts?: Record<string, unknown>) => NodeJS.WritableStream;
    const req = createRequire(metaUrl);
    const prettySpec = "pino" + "-" + "pretty";
    const pretty = req(prettySpec) as PrettyFactory;

    return pino(
      options,
      pretty({
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        messageFormat: "{msg}",
        hideObject: false,
        singleLine: false,
        useLevelLabels: true,
        levelFirst: true,
      }),
    );
  } catch {
    return pino(options);
  }
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
