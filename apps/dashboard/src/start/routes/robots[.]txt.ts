import { createFileRoute } from "@tanstack/react-router";
import { baseUrl } from "@/site/sitemap";

export const Route = createFileRoute("/robots.txt")({
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
