import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { baseUrl } from "@/site/base-url";

const title = "Updates";
const description =
  "The latest updates and improvements to Tamias. See what we've been building to help you manage your business finances better.";

export const Route = createSiteFileRoute("/updates/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${baseUrl}/updates` },
    ],
  }),
});
