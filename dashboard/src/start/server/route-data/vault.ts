import { getInitialTableSettings } from "@/utils/columns";
import { buildShellOnlyPageData } from "@/start/server/route-data/shared";

export async function buildVaultPageData(_href?: string) {
  const result = await buildShellOnlyPageData();
  const initialSettings = await getInitialTableSettings("vault");

  return {
    ...result,
    initialSettings,
  };
}
