import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  getDocMetadataBySlug,
} from "@/site/lib/docs";

export const Route = createSiteFileRoute("/docs/$slug")({
  head: ({ params }) => {
    const doc = getDocMetadataBySlug(params.slug);

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
