import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";
import { getAppUrl } from "@tamias/utils/envs";

const appUrl = getAppUrl();

const loadPublicInvoice = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string; viewer?: string | null }) => data)
  .handler(async ({ data }) => {
    const { buildPublicInvoicePageData } = await import(
      "@/start/server/route-data/public"
    );
    return (await buildPublicInvoicePageData({
      token: data.token,
      viewer: data.viewer ?? undefined,
    })) as any;
  });

export type PublicInvoiceLoaderData = Awaited<
  ReturnType<typeof loadPublicInvoice>
>;

export const Route = createAppPublicFileRoute("/i/$token")({
  loader: ({ params, location }) => {
    const url = new URL(location.href, "http://localhost");
    return loadPublicInvoice({
      data: {
        token: params.token,
        viewer: url.searchParams.get("viewer"),
      },
    });
  },
  head: ({ loaderData }) => {
    const data = loaderData as Awaited<
      ReturnType<typeof loadPublicInvoice>
    > | null | undefined;

    if (!data || data.status !== "ok") {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const imageUrl = `${appUrl}/i/${data.invoice.token}/opengraph-image`;

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
        { property: "og:url", content: `${appUrl}/i/${data.invoice.token}` },
        { property: "og:image", content: imageUrl },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: data.metadata.title },
        { name: "twitter:description", content: data.metadata.description },
        { name: "twitter:image", content: imageUrl },
      ],
    };
  },
});
