import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { getAppSummaryBySlug } from "@/site/data/app-catalog";
import { baseUrl } from "@/site/base-url";

export const Route = createSiteFileRoute("/integrations/$slug")({
  head: ({ params }) => {
    const app = getAppSummaryBySlug(params.slug);

    if (!app) {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const title = `${app.name} Integration`;
    const description = app.short_description;
    const url = `${baseUrl}/integrations/${params.slug}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
