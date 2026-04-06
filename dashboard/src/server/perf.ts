import { cache } from "react";

const PERF_ENABLED = process.env.DEBUG_PERF === "true";

type ServerPerfState = {
  trpcCalls: number;
};

const getServerPerfState = cache<() => ServerPerfState>(() => ({
  trpcCalls: 0,
}));

function logPerf(event: string, payload: Record<string, unknown>) {
  if (!PERF_ENABLED) {
    return;
  }

  console.info(`[dashboard:ssr:${event}]`, payload);
}

export function noteSsrTrpcCall(url: string) {
  const state = getServerPerfState();
  state.trpcCalls += 1;

  logPerf("trpc-call", {
    count: state.trpcCalls,
    url,
  });
}

export async function measureServerRead<T>(name: string, read: () => Promise<T>): Promise<T> {
  if (!PERF_ENABLED) {
    return read();
  }

  const startedAt = performance.now();

  try {
    return await read();
  } finally {
    logPerf("server-read", {
      name,
      durationMs: +(performance.now() - startedAt).toFixed(2),
      trpcCalls: getServerPerfState().trpcCalls,
    });
  }
}

export async function measureAuthResolution<T>(
  name: string,
  resolve: () => Promise<T>,
): Promise<T> {
  if (!PERF_ENABLED) {
    return resolve();
  }

  const startedAt = performance.now();

  try {
    return await resolve();
  } finally {
    logPerf("auth", {
      name,
      durationMs: +(performance.now() - startedAt).toFixed(2),
    });
  }
}
