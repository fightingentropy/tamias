import {
  getComplianceProfileLocally,
  getPayrollDashboardLocally,
  getVatDashboardLocally,
  getVatSubmissionsLocally,
  getYearEndDashboardLocally,
} from "@/server/loaders/compliance";
import { trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildCompliancePageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const vatDashboardQuery = trpc.vat.getDashboard.queryOptions();
  const vatDashboardResult = await getVatDashboardLocally().catch(() => null);

  if (vatDashboardResult) {
    queryClient.setQueryData(vatDashboardQuery.queryKey, vatDashboardResult);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildCompliancePayrollPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const dashboard = await getPayrollDashboardLocally().catch(() => null);

  if (dashboard) {
    queryClient.setQueryData(trpc.payroll.getDashboard.queryKey(), dashboard);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceSettingsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const profile = await getComplianceProfileLocally();

  queryClient.setQueryData(trpc.compliance.getProfile.queryKey(), profile);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceVatPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
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

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceYearEndPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const dashboard = await getYearEndDashboardLocally().catch(() => null);

  if (dashboard) {
    queryClient.setQueryData(trpc.yearEnd.getDashboard.queryKey(), dashboard);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
