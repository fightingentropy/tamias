import { createLazyFileRoute } from "@tanstack/react-router";
import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import { PortalContent } from "@/components/public/customer-portal-content";
import { NotFoundPage } from "@/start/components/not-found-page";
import {
  Route as CustomerPortalRoute,
  type CustomerPortalLoaderData,
} from "./$portalId";

export const Route = createLazyFileRoute("/p/$portalId")({
  component: CustomerPortalPage,
});

function CustomerPortalPage() {
  const loaderData = CustomerPortalRoute.useLoaderData() as CustomerPortalLoaderData;

  if (loaderData.status !== "ok") {
    return <NotFoundPage />;
  }

  return (
    <HydrationBoundary
      state={
        loaderData.dehydratedState as unknown as
          | DehydratedState
          | null
          | undefined
      }
    >
      <PortalContent portalId={loaderData.portalId} />
    </HydrationBoundary>
  );
}
