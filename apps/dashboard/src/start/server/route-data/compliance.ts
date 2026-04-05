import { batchPrefetch, trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildCompliancePageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const vatDashboardQuery = trpc.vat.getDashboard.queryOptions();
  const yearEndDashboardQuery = trpc.yearEnd.getDashboard.queryOptions();
  const payrollDashboardQuery = trpc.payroll.getDashboard.queryOptions();

  await batchPrefetch([
    vatDashboardQuery,
    yearEndDashboardQuery,
    payrollDashboardQuery,
  ]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildCompliancePayrollPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const dashboardQuery = trpc.payroll.getDashboard.queryOptions();
  const runsQuery = trpc.payroll.listRuns.queryOptions();

  await batchPrefetch([dashboardQuery, runsQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceSettingsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  await queryClient.fetchQuery(trpc.compliance.getProfile.queryOptions());

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceVatPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const vatDashboardQuery = trpc.vat.getDashboard.queryOptions();
  const vatSubmissionsQuery = trpc.vat.listSubmissions.queryOptions();

  await batchPrefetch([vatDashboardQuery, vatSubmissionsQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceYearEndPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  await queryClient.fetchQuery(trpc.yearEnd.getDashboard.queryOptions());

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
