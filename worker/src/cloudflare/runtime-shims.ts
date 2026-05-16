const workerGlobal = globalThis as unknown as Record<string, unknown>;

if (!workerGlobal["window"]) {
  workerGlobal["window"] = workerGlobal;
}

export {};
