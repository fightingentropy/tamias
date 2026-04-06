let searchModulePromise: Promise<typeof import("@/components/search/search")> | undefined;

export function loadSearchModule() {
  if (!searchModulePromise) {
    searchModulePromise = import("@/components/search/search");
  }

  return searchModulePromise;
}

export function prefetchSearchModule() {
  void loadSearchModule();
}
