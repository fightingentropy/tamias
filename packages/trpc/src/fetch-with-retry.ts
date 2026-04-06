const RETRYABLE_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "UND_ERR_SOCKET"]);

const RETRYABLE_NAMES = new Set(["TimeoutError"]);

const MAX_RETRIES = 1;
const TIMEOUT_MS = 5_000;

function isRetryable(err: any): boolean {
  const code = err?.cause?.code ?? err?.code ?? "";
  if (RETRYABLE_CODES.has(code)) return true;

  const name = err?.name ?? "";
  if (RETRYABLE_NAMES.has(name)) return true;

  return false;
}

/**
 * Fetch wrapper for service-to-service calls over an optional internal API URL.
 *
 * During deploys or local restarts, pooled keep-alive connections can point at
 * dead instances. The 5s timeout fails fast, and the retry gives the caller a
 * second chance once the target is reachable again.
 */
export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

      const headers = new Headers(init?.headers);

      // Force fresh TCP connections when using an explicit internal API URL so
      // the caller does not reuse keep-alive sockets against stale instances.
      if (process.env.API_INTERNAL_URL) {
        headers.set("Connection", "close");
      }

      return await fetch(input, { ...init, signal, headers });
    } catch (err: any) {
      lastError = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
    }
  }
  throw lastError;
}
