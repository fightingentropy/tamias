import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { baseUrl } from "@/site/base-url";

export const Route = createSiteFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\nHost: ${baseUrl}\n`,
          {
            headers: {
              "content-type": "text/plain; charset=utf-8",
            },
          },
        ),
    },
  },
});
