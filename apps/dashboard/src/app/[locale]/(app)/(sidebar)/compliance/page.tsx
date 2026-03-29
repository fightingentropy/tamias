import type { Metadata } from "next";
import { ComplianceOverview } from "@/components/compliance/compliance-overview";
import { getVatDashboardLocally } from "@/server/loaders/compliance";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Compliance | Tamias",
};

export default async function CompliancePage() {
  const queryClient = getQueryClient();

  const vatDashboardQuery = trpc.vat.getDashboard.queryOptions();
  const vatDashboardResult = await getVatDashboardLocally().catch(() => null);

  if (vatDashboardResult) {
    queryClient.setQueryData(vatDashboardQuery.queryKey, vatDashboardResult);
  }

  return (
    <HydrateClient>
      <ComplianceOverview />
    </HydrateClient>
  );
}
