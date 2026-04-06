const STORAGE_KEY = "tamias:bankInitialSyncRunId";
export const BANK_INITIAL_SYNC_RUN_PERSIST_EVENT = "tamias:bankInitialSyncRunId";

export function persistBankInitialSyncRunId(runId: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, runId);
  } catch {
    // ignore quota / private mode
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BANK_INITIAL_SYNC_RUN_PERSIST_EVENT));
  }
}

export function readBankInitialSyncRunId(): string | undefined {
  if (typeof sessionStorage === "undefined") {
    return undefined;
  }
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return v && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}

export function clearBankInitialSyncRunId() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
