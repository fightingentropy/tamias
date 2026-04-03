import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { baseUrl } from "@/site/sitemap";

const title = "Pricing";
const description =
  "Simple, transparent pricing for Tamias. Start free and upgrade as you grow. Invoicing, expense tracking, and financial tools for small business owners.";

export const Route = createSiteFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${baseUrl}/pricing` },
    ],
  }),
});
