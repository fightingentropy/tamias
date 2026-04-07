import { getStartContext } from "@tanstack/start-storage-context";
import { geolocation } from "@/utils/geo";
import { buildShellOnlyPageData } from "@/start/server/route-data/shared";

export async function buildDashboardPageData(_href?: string) {
  const result = await buildShellOnlyPageData();

  return {
    ...result,
    initialPreferences: null,
    geo: geolocation(getStartContext().request.headers as Headers),
  };
}
