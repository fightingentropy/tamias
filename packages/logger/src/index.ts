import { createRequire } from "node:module";
import pino from "pino";

/**
 * Human-readable logs for local Vite/Node dev only (`NODE_ENV=development`).
 * If `LOG_PRETTY=true` but `NODE_ENV` is unset (common under Bun) or `production`
 * (build / `vite preview`), we stay on JSON — otherwise bundled SSR hits
 * `import.meta.url`-less contexts and `pino-pretty` / `createRequire` break.
 */
const isPretty =
  process.env.LOG_PRETTY === "true" && process.env.NODE_ENV === "development";

const serializers = {
  req: pino.stdSerializers.req,
  res: pino.stdSerializers.res,
  err: pino.stdSerializers.err,
};

function createBaseLogger(): pino.Logger {
  const options = {
    level: process.env.LOG_LEVEL || "info",
    serializers,
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
    const pretty = req("pino-pretty") as PrettyFactory;

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

/** Base pino logger instance */
const baseLogger = createBaseLogger();

/**
 * Create a logger adapter that wraps pino to match the existing API
 */
function createLoggerAdapter(pinoLogger: pino.Logger, prefixContext?: string) {
  // Format context with brackets if not already formatted
  const formatContext = (ctx?: string): string => {
    if (!ctx) return "";
    // If already has brackets, use as-is, otherwise wrap in brackets
    if (ctx.startsWith("[") && ctx.endsWith("]")) {
      return ctx;
    }
    return `[${ctx}]`;
  };

  const formattedContext = formatContext(prefixContext);

  return {
    info: (message: string, data?: object) => {
      try {
        const fullMessage = formattedContext ? `${formattedContext} ${message}` : message;
        if (data) {
          pinoLogger.info(data, fullMessage);
        } else {
          pinoLogger.info(fullMessage);
        }
      } catch (_error) {
        // Silently ignore logger stream errors to prevent crashes
        // This can happen when pino-pretty transport's stream is closing
      }
    },
    error: (message: string, data?: object) => {
      try {
        const fullMessage = formattedContext ? `${formattedContext} ${message}` : message;
        if (data) {
          pinoLogger.error(data, fullMessage);
        } else {
          pinoLogger.error(fullMessage);
        }
      } catch (_error) {
        // Silently ignore logger stream errors to prevent crashes
        // This can happen when pino-pretty transport's stream is closing
      }
    },
    warn: (message: string, data?: object) => {
      try {
        const fullMessage = formattedContext ? `${formattedContext} ${message}` : message;
        if (data) {
          pinoLogger.warn(data, fullMessage);
        } else {
          pinoLogger.warn(fullMessage);
        }
      } catch (_error) {
        // Silently ignore logger stream errors to prevent crashes
        // This can happen when pino-pretty transport's stream is closing
      }
    },
    debug: (message: string, data?: object) => {
      try {
        const fullMessage = formattedContext ? `${formattedContext} ${message}` : message;
        if (data) {
          pinoLogger.debug(data, fullMessage);
        } else {
          pinoLogger.debug(fullMessage);
        }
      } catch (_error) {
        // Silently ignore logger stream errors to prevent crashes
        // This can happen when pino-pretty transport's stream is closing
      }
    },
  };
}

/**
 * Default logger instance
 */
export const logger = createLoggerAdapter(baseLogger);

/**
 * Create a child logger with additional context
 * @param context - Context string to prepend to all log messages
 * @returns A new logger instance with the context
 *
 * @example
 * ```ts
 * const logger = createLoggerWithContext("my-component");
 * logger.info("Processing", { userId: 123 }); // Will log with "my-component" as context
 * ```
 */
export function createLoggerWithContext(context: string) {
  const childLogger = baseLogger.child({ context });
  return createLoggerAdapter(childLogger, context);
}

/**
 * Change the log level at runtime. Affects all existing child loggers.
 */
export function setLogLevel(level: string) {
  baseLogger.level = level;
}

export default logger;
