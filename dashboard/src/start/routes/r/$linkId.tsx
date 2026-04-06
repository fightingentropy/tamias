import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";
import { getAppUrl } from "@tamias/utils/envs";

const appUrl = getAppUrl();

const loadPublicReportData = createServerFn({ method: "GET" })
  .inputValidator((data: { linkId: string }) => data)
  .handler(async ({ data }) => {
    const { buildPublicReportPageData } = await import("@/start/server/route-data/public");

    return await buildPublicReportPageData(data.linkId);
  });

export type PublicReportLoaderData = Awaited<ReturnType<typeof loadPublicReportData>>;

export const Route = createAppPublicFileRoute("/r/$linkId")({
  loader: ({ params }) =>
    loadPublicReportData({
      data: {
        linkId: params.linkId,
      },
    }),
  head: ({ loaderData }) => {
    const data = loaderData as Awaited<ReturnType<typeof loadPublicReportData>> | null | undefined;

    if (!data || data.status !== "ok") {
      return {
        meta: [{ title: "Page not found" }, { name: "robots", content: "noindex,nofollow" }],
      };
    }

    const imageUrl = `${appUrl}/r/${data.report.linkId}/opengraph-image`;

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
        { property: "og:url", content: `${appUrl}/r/${data.report.linkId}` },
        { property: "og:image", content: imageUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: data.metadata.title },
        { name: "twitter:description", content: data.metadata.description },
        { name: "twitter:image", content: imageUrl },
      ],
    };
  },
});
