import type { Metadata } from "next";
import { VatDashboard } from "@/components/compliance/vat-dashboard";
import {
  getVatDashboardLocally,
  getVatSubmissionsLocally,
} from "@/server/loaders/compliance";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "VAT Filing | Tamias",
};

export default async function VatPage() {
  const queryClient = getQueryClient();

  const vatDashboardQuery = trpc.vat.getDashboard.queryOptions();
  const vatSubmissionsQuery = trpc.vat.listSubmissions.queryOptions();
  const [vatDashboardResult, vatSubmissionsResult] = await Promise.allSettled([
    getVatDashboardLocally(),
    getVatSubmissionsLocally(),
  ]);

  if (vatDashboardResult.status === "fulfilled") {
    queryClient.setQueryData(
      vatDashboardQuery.queryKey,
      vatDashboardResult.value,
    );
  }

  if (vatSubmissionsResult.status === "fulfilled") {
    queryClient.setQueryData(
      vatSubmissionsQuery.queryKey,
      vatSubmissionsResult.value,
    );
  }

  return (
    <HydrateClient>
      <VatDashboard />
    </HydrateClient>
  );
}
