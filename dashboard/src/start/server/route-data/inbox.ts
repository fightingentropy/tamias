import { buildShellOnlyPageData } from "./shared";

export async function buildInboxPageData(_href?: string) {
  const result = await buildShellOnlyPageData();

  return {
    ...result,
    // Default to "list" view — client will determine correct view after data loads.
    view: "list" as const,
  };
}

export async function buildInboxSettingsPageData() {
  return buildShellOnlyPageData();
}
