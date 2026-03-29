import type { Metadata } from "next";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import { Suspense } from "react";
import { Apps } from "@/components/apps";
import { AppsSkeleton } from "@/components/apps.skeleton";
import { AppsHeader } from "@/components/apps-header";
import { ErrorFallback } from "@/components/error-fallback";
import {
  getAuthorizedOAuthApplicationsLocally,
  getInstalledAppsLocally,
  getOAuthApplicationsLocally,
  getStripeStatusLocally,
} from "@/server/loaders/apps";
import { getInboxAccountsLocally } from "@/server/loaders/inbox";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Apps | Tamias",
};

export default async function Page() {
  const queryClient = getQueryClient();
  const installedAppsQuery = trpc.apps.get.queryOptions();
  const oauthApplicationsQuery = trpc.oauthApplications.list.queryOptions();
  const authorizedApplicationsQuery =
    trpc.oauthApplications.authorized.queryOptions();
  const inboxAccountsQuery = trpc.inboxAccounts.get.queryOptions();
  const stripeStatusQuery = trpc.invoicePayments.stripeStatus.queryOptions();

  const [
    installedAppsResult,
    oauthApplicationsResult,
    authorizedApplicationsResult,
    inboxAccountsResult,
    stripeStatusResult,
  ] = await Promise.allSettled([
    getInstalledAppsLocally(),
    getOAuthApplicationsLocally(),
    getAuthorizedOAuthApplicationsLocally(),
    getInboxAccountsLocally(),
    getStripeStatusLocally(),
  ]);

  if (installedAppsResult.status === "fulfilled") {
    queryClient.setQueryData(
      installedAppsQuery.queryKey,
      installedAppsResult.value,
    );
  }

  if (oauthApplicationsResult.status === "fulfilled") {
    queryClient.setQueryData(
      oauthApplicationsQuery.queryKey,
      oauthApplicationsResult.value,
    );
  }

  if (authorizedApplicationsResult.status === "fulfilled") {
    queryClient.setQueryData(
      authorizedApplicationsQuery.queryKey,
      authorizedApplicationsResult.value,
    );
  }

  if (inboxAccountsResult.status === "fulfilled") {
    queryClient.setQueryData(
      inboxAccountsQuery.queryKey,
      inboxAccountsResult.value,
    );
  }

  if (stripeStatusResult.status === "fulfilled") {
    queryClient.setQueryData(
      stripeStatusQuery.queryKey,
      stripeStatusResult.value,
    );
  }

  return (
    <HydrateClient>
      <div className="mt-4">
        <AppsHeader />

        <ErrorBoundary errorComponent={ErrorFallback}>
          <Suspense fallback={<AppsSkeleton />}>
            <Apps />
          </Suspense>
        </ErrorBoundary>
      </div>
    </HydrateClient>
  );
}
