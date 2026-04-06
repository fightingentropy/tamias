/**
 * Detects local-dev failures when hosted Convex service calls need
 * `CONVEX_SERVICE_KEY` but it is unset. Walks `cause` chains because tRPC /
 * Workers may wrap the original `Error`.
 */
export function isMissingConvexServiceKeyError(error: unknown): boolean {
  return collectErrorMessages(error).includes("CONVEX_SERVICE_KEY");
}

function collectErrorMessages(error: unknown, depth = 0): string {
  if (error == null || depth > 12) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
    const nested = collectErrorMessages(error.cause, depth + 1);
    if (nested) {
      parts.push(nested);
    }
    return parts.join(" ");
  }

  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      parts.push(message);
    }
    if ("cause" in error) {
      const nested = collectErrorMessages(
        (error as { cause?: unknown }).cause,
        depth + 1,
      );
      if (nested) {
        parts.push(nested);
      }
    }
  }

  return parts.join(" ");
}
