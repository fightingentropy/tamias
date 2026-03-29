const workerGlobal = globalThis as typeof globalThis & {
  window?: unknown;
};

if (!workerGlobal.window) {
  workerGlobal.window = workerGlobal as unknown as Window & typeof globalThis;
}

export {};
