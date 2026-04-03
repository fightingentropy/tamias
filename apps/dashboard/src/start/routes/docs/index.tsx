import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { baseUrl } from "@/site/sitemap";

const title = "Documentation";
const description =
  "Learn how to use Tamias to run your business. Get answers about invoicing, banking, time tracking, reports, and more.";

export const Route = createSiteFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${baseUrl}/docs` },
    ],
  }),
});
