import type { Metadata } from "next";
import { YearEndDashboardClient } from "@/components/compliance/year-end-dashboard-client";
import { getYearEndDashboardLocally } from "@/server/loaders/compliance";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Year-end | Tamias",
};

export default async function YearEndPage() {
  const queryClient = getQueryClient();
  const dashboard = await getYearEndDashboardLocally().catch(() => null);

  if (dashboard) {
    queryClient.setQueryData(trpc.yearEnd.getDashboard.queryKey(), dashboard);
  }

  return (
    <HydrateClient>
      <YearEndDashboardClient />
    </HydrateClient>
  );
}
