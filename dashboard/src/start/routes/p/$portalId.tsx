import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getAppUrl } from "@tamias/utils/envs";

const appUrl = getAppUrl();

const loadCustomerPortalData = createServerFn({ method: "GET" })
  .inputValidator((data: { portalId: string }) => data)
  .handler(async ({ data }) => {
    const { buildCustomerPortalPageData } = await import("@/start/server/route-data/public");

    return await buildCustomerPortalPageData(data.portalId);
  });

export type CustomerPortalLoaderData = Awaited<ReturnType<typeof loadCustomerPortalData>>;

export const Route = createAppPublicFileRoute("/p/$portalId")({
  loader: ({ params }) =>
    loadCustomerPortalData({
      data: {
        portalId: params.portalId,
      },
    }),
  head: ({ loaderData }) => {
    const data = loaderData as
      | Awaited<ReturnType<typeof loadCustomerPortalData>>
      | null
      | undefined;

    if (!data || data.status !== "ok") {
      return {
        meta: [{ title: "Page not found" }, { name: "robots", content: "noindex,nofollow" }],
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
});
