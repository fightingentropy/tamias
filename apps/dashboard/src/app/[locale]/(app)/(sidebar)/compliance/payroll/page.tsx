import type { Metadata } from "next";
import { PayrollDashboard } from "@/components/compliance/payroll-dashboard";
import { getPayrollDashboardLocally } from "@/server/loaders/compliance";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Payroll | Tamias",
};

export default async function PayrollPage() {
  const queryClient = getQueryClient();
  const dashboard = await getPayrollDashboardLocally().catch(() => null);

  if (dashboard) {
    queryClient.setQueryData(trpc.payroll.getDashboard.queryKey(), dashboard);
  }

  return (
    <HydrateClient>
      <PayrollDashboard />
    </HydrateClient>
  );
}
