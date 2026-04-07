import { getInitialTableSettings } from "@/utils/columns";
import { buildShellOnlyPageData } from "@/start/server/route-data/shared";

export async function buildCustomersPageData(_href?: string) {
  const result = await buildShellOnlyPageData();
  const initialSettings = await getInitialTableSettings("customers");

  return {
    ...result,
    initialSettings,
  };
}
