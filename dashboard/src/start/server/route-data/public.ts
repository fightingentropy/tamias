import { decrypt } from "@tamias/encryption";
import { format, parseISO } from "date-fns";
import { getConvexAuthToken } from "@/start/auth/server";
import { getChartDisplayName } from "@/components/metrics/utils/chart-types";
import { loadOAuthParams } from "@/hooks/use-oauth-params";
import { getTRPCClient, getQueryClient, trpc } from "@/trpc/server";
import { categorizeOAuthError, validateOAuthParams } from "@/utils/oauth-utils";
import {
  dehydrateQueryClient,
  getRequestUrl,
  isNotFoundQueryError,
  isUnauthorizedQueryError,
} from "./shared";

export async function buildCustomerPortalPageData(portalId: string) {
  const queryClient = getQueryClient();
  const portalDataQuery = trpc.customers.getByPortalId.queryOptions({
    portalId,
  });
  const portalInvoicesQuery = trpc.customers.getPortalInvoices.infiniteQueryOptions(
    {
      portalId,
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );

  const portalData = await queryClient.fetchQuery(portalDataQuery);

  if (!portalData) {
    return {
      status: "not-found" as const,
    };
  }

  await queryClient.fetchInfiniteQuery(portalInvoicesQuery as any);

  const customerName = portalData.customer.name;
  const teamName = portalData.customer.team.name || "Tamias";

  return {
    status: "ok" as const,
    portalId,
    dehydratedState: dehydrateQueryClient(queryClient),
    metadata: {
      title: `${customerName} | ${teamName}`,
      description: `Customer portal for ${customerName}`,
    },
  };
}

export async function buildPublicReportPageData(linkId: string) {
  const queryClient = getQueryClient();
  const report = await queryClient
    .fetchQuery(trpc.reports.getByLinkId.queryOptions({ linkId }))
    .catch((error) => {
      if (isNotFoundQueryError(error)) {
        return null;
      }

      throw error;
    });

  if (!report) {
    return {
      status: "not-found" as const,
    };
  }

  if (report.expireAt && new Date(report.expireAt) < new Date()) {
    return {
      status: "not-found" as const,
    };
  }

  const chartName = report.type ? getChartDisplayName(report.type as any) : "Shared Report";
  const teamName = report.teamName || "Company";
  const dateRangeDisplay =
    report.from && report.to
      ? `${format(parseISO(report.from), "MMM d")} - ${format(parseISO(report.to), "MMM d, yyyy")}`
      : "";
  const chartDataQuery = trpc.reports.getChartDataByLinkId.queryOptions({
    linkId,
  });

  await queryClient.fetchQuery(chartDataQuery).catch(() => undefined);

  return {
    status: "ok" as const,
    report,
    chartName,
    teamName,
    dateRangeDisplay,
    dehydratedState: dehydrateQueryClient(queryClient),
    metadata: {
      title: `${teamName} - ${chartName}`,
      description: `Shared ${chartName} report from ${teamName}`,
    },
  };
}

export async function buildShortLinkPageData(shortId: string) {
  const queryClient = getQueryClient();
  const shortLink = await queryClient
    .fetchQuery(trpc.shortLinks.get.queryOptions({ shortId }))
    .catch((error) => {
      if (isNotFoundQueryError(error)) {
        return null;
      }

      throw error;
    });

  if (!shortLink?.url) {
    return {
      status: "not-found" as const,
    };
  }

  if (shortLink.expiresAt && new Date(shortLink.expiresAt) < new Date()) {
    return {
      status: "not-found" as const,
    };
  }

  if (shortLink.type === "redirect") {
    return {
      status: "redirect" as const,
      href: shortLink.url,
    };
  }

  return {
    status: "ok" as const,
    shortLink,
  };
}

export async function buildOAuthAuthorizePageData(href?: string) {
  const requestUrl = getRequestUrl(href);
  const queryClient = getQueryClient();
  const { response_type, client_id, redirect_uri, scope, state } = loadOAuthParams(
    Object.fromEntries(requestUrl.searchParams.entries()),
  );
  const validation = validateOAuthParams({
    response_type: response_type || undefined,
    client_id: client_id || undefined,
    redirect_uri: redirect_uri || undefined,
    scope: scope || undefined,
  });

  if (!validation.isValid) {
    return {
      status: "error" as const,
      errorType: validation.errorType!,
    };
  }

  const currentUserQuery = trpc.user.me.queryOptions();
  const currentUser = await queryClient.fetchQuery(currentUserQuery).catch((error) => {
    if (isUnauthorizedQueryError(error)) {
      return null;
    }

    throw error;
  });

  if (!currentUser) {
    return {
      status: "error" as const,
      errorType: "user_not_authenticated" as const,
    };
  }

  try {
    const applicationInfoQuery = trpc.oauthApplications.getApplicationInfo.queryOptions({
      clientId: client_id!,
      redirectUri: redirect_uri!,
      scope: scope!,
      state: state || undefined,
    });
    await Promise.all([
      queryClient.fetchQuery(applicationInfoQuery),
      queryClient.fetchQuery(trpc.team.list.queryOptions()),
      queryClient.fetchQuery(trpc.team.current.queryOptions()),
    ]);

    return {
      status: "ready" as const,
      dehydratedState: dehydrateQueryClient(queryClient),
    };
  } catch (error) {
    const { errorType, customMessage, details } = categorizeOAuthError(error);

    return {
      status: "error" as const,
      errorType,
      customMessage,
      details,
    };
  }
}

export async function buildPublicInvoicePageData(params: { token: string; viewer?: string }) {
  const authToken = await getConvexAuthToken();
  const client = await getTRPCClient();
  const invoice = await client.invoice.getInvoiceByToken
    .query({
      token: params.token,
    })
    .catch(() => null);

  if (!invoice) {
    return {
      status: "not-found" as const,
    };
  }

  if (params.viewer && params.viewer.trim().length > 0) {
    try {
      const decryptedEmail = decrypt(params.viewer);

      if (decryptedEmail === invoice.customer?.email) {
        await client.invoice.markViewedByToken.mutate({
          token: params.token,
        });
      }
    } catch {
      // Ignore invalid viewer tokens.
    }
  }

  if (invoice.status === "draft" && !authToken) {
    return {
      status: "not-found" as const,
    };
  }

  const width = invoice.template.size === "letter" ? 750 : 595;
  const height = invoice.template.size === "letter" ? 1056 : 842;
  const paymentEnabled = invoice.template.paymentEnabled && invoice.team?.stripeConnected === true;

  return {
    status: "ok" as const,
    invoice,
    width,
    height,
    paymentEnabled,
    metadata: {
      title: `Invoice ${invoice.invoiceNumber} | ${invoice.team?.name}`,
      description: `Invoice for ${invoice.customerName || invoice.customer?.name || "Customer"}`,
    },
  };
}
