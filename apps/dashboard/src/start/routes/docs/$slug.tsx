import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";

export const Route = createSiteFileRoute("/docs/$slug")({
  loader: async ({ params }) => {
    const { getDocMetadataBySlug } = await import("@/site/lib/docs-metadata");

    return getDocMetadataBySlug(params.slug);
  },
  head: ({ loaderData }) => {
    const doc = loaderData;

    if (!doc) {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    return {
      meta: [
        { title: doc.metadata.title },
        {
          name: "description",
          content: doc.metadata.description,
        },
        { property: "og:title", content: doc.metadata.title },
        {
          property: "og:description",
          content: doc.metadata.description,
        },
      ],
    };
  },
});
