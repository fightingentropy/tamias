import type { Logger } from "pino";
import pino from "pino";

export const loggerSerializers = {
  req: pino.stdSerializers.req,
  res: pino.stdSerializers.res,
  err: pino.stdSerializers.err,
};

/**
 * Create a logger adapter that wraps pino to match the existing API
 */
export function createLoggerAdapter(pinoLogger: Logger, prefixContext?: string) {
  const formatContext = (ctx?: string): string => {
    if (!ctx) return "";
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
      }
    },
  };
}
