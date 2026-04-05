import { cookies } from "@tamias/utils/request-runtime";
import { loadSortParams } from "@/hooks/use-sort-params";
import { loadTrackerFilterParams } from "@/hooks/use-tracker-filter-params";
import { batchPrefetch, trpc } from "@/trpc/server";
import { Cookies } from "@/utils/constants";
import { buildTrackerProjectsQueryFilter } from "@/utils/tracker-projects-query";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getRequestUrl,
} from "@/start/server/route-data/shared";

export async function buildTrackerPageData(href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadTrackerFilterParams(requestUrl.searchParams);
  const { sort } = loadSortParams(requestUrl.searchParams);
  const weeklyCalendar =
    (await cookies()).get(Cookies.WeeklyCalendar)?.value === "true";
  const trackerProjectsQuery = trpc.trackerProjects.get.infiniteQueryOptions(
    buildTrackerProjectsQueryFilter({
      filter,
      sort,
    }),
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );

  await batchPrefetch([trackerProjectsQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    weeklyCalendar,
  };
}
