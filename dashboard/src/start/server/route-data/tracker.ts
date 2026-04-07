import { cookies } from "@tamias/utils/request-runtime";
import { Cookies } from "@/utils/constants";
import { buildShellOnlyPageData } from "@/start/server/route-data/shared";

export async function buildTrackerPageData(_href?: string) {
  const result = await buildShellOnlyPageData();
  const weeklyCalendar = (await cookies()).get(Cookies.WeeklyCalendar)?.value === "true";

  return {
    ...result,
    weeklyCalendar,
  };
}
