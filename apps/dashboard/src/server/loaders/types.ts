import type { getInvoiceByToken } from "@tamias/app-services/invoice-by-token";
import type { AppRouter } from "@tamias/trpc";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type LocalInvoiceByToken = Awaited<ReturnType<typeof getInvoiceByToken>>;
export type LocalPortalData = RouterOutputs["customers"]["getByPortalId"];
export type LocalPortalInvoices =
  RouterOutputs["customers"]["getPortalInvoices"];
export type LocalReportByLinkId = RouterOutputs["reports"]["getByLinkId"];
export type LocalReportChartData =
  RouterOutputs["reports"]["getChartDataByLinkId"];
export type LocalShortLink = RouterOutputs["shortLinks"]["get"];
