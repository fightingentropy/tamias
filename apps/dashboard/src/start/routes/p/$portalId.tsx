import {
  HydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getAppUrl } from "@tamias/utils/envs";
import { PortalContent } from "@/components/public/customer-portal-content";
import { NotFoundPage } from "@/start/components/not-found-page";

const appUrl = getAppUrl();

const loadCustomerPortalData = createServerFn({ method: "GET" })
  .inputValidator((data: { portalId: string }) => data)
  .handler(async ({ data }) => {
    const { buildCustomerPortalPageData } = await import(
      "@/start/server/route-data"
    );

    return (await buildCustomerPortalPageData(data.portalId)) as any;
  });

export const Route = createFileRoute("/p/$portalId")({
  loader: ({ params }) =>
    loadCustomerPortalData({
      data: {
        portalId: params.portalId,
      },
    }),
  head: ({ loaderData }) => {
    const data = loaderData as Awaited<
      ReturnType<typeof loadCustomerPortalData>
    > | null | undefined;

    if (!data || data.status !== "ok") {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const imageUrl = `${appUrl}/p/${data.portalId}/opengraph-image`;

    return {
      meta: [
        { title: data.metadata.title },
        {
          name: "description",
          content: data.metadata.description,
        },
        { name: "robots", content: "noindex,nofollow" },
        { property: "og:title", content: data.metadata.title },
        {
          property: "og:description",
          content: data.metadata.description,
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${appUrl}/p/${data.portalId}` },
        { property: "og:image", content: imageUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: data.metadata.title },
        { name: "twitter:description", content: data.metadata.description },
        { name: "twitter:image", content: imageUrl },
      ],
    };
  },
  component: CustomerPortalPage,
});

function CustomerPortalPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadCustomerPortalData>
  >;

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
