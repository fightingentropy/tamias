import type { getInvoiceByToken } from "@tamias/app-services/invoice-by-token";
import type { AppRouter } from "@tamias/trpc";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type LocalApiKeys = RouterOutputs["apiKeys"]["get"];
export type LocalAuthorizedOAuthApplications =
  RouterOutputs["oauthApplications"]["authorized"];
export type LocalChatMessages = RouterOutputs["chats"]["get"];
export type LocalCurrentTeam = RouterOutputs["team"]["current"];
export type LocalCurrentUser = RouterOutputs["user"]["me"];
export type LocalCurrentUserInvites = RouterOutputs["user"]["invites"];
export type LocalInstalledApps = RouterOutputs["apps"]["get"];
export type LocalInvoiceByToken = Awaited<ReturnType<typeof getInvoiceByToken>>;
export type LocalOAuthApplicationInfo =
  RouterOutputs["oauthApplications"]["getApplicationInfo"];
export type LocalOAuthApplications = RouterOutputs["oauthApplications"]["list"];
export type LocalPortalData = RouterOutputs["customers"]["getByPortalId"];
export type LocalPortalInvoices =
  RouterOutputs["customers"]["getPortalInvoices"];
export type LocalReportByLinkId = RouterOutputs["reports"]["getByLinkId"];
export type LocalReportChartData =
  RouterOutputs["reports"]["getChartDataByLinkId"];
export type LocalShortLink = RouterOutputs["shortLinks"]["get"];
export type LocalStripeStatus =
  RouterOutputs["invoicePayments"]["stripeStatus"];
export type LocalSuggestedActions = RouterOutputs["suggestedActions"]["list"];
export type LocalTeamInvites = RouterOutputs["team"]["teamInvites"];
export type LocalTeamInvitesByEmail = RouterOutputs["team"]["invitesByEmail"];
export type LocalTeamList = RouterOutputs["team"]["list"];
export type LocalTeamMembers = RouterOutputs["team"]["members"];
export type LocalWidgetPreferences =
  RouterOutputs["widgets"]["getWidgetPreferences"];
