import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { baseUrl } from "@/site/base-url";

export const Route = createSiteFileRoute("/compare/$slug")({
  loader: async ({ params }) => {
    const { getCompetitorBySlug } = await import("@/site/data/competitors");

    return getCompetitorBySlug(params.slug);
  },
  head: ({ params, loaderData }) => {
    const competitor = loaderData;

    if (!competitor) {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const year = new Date().getFullYear();
    const title = `Best ${competitor.name} Alternative for Founders (${year}) | Tamias`;
    const description = `Looking for a ${competitor.name} alternative? Switch to Tamias - built for founders, not accountants. Compare features, pricing, and see why teams are making the switch. Free trial available.`;
    const image = `${baseUrl}/api/og/compare?name=${encodeURIComponent(competitor.name)}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "keywords",
          content: [
            `${competitor.name.toLowerCase()} alternative`,
            `${competitor.name.toLowerCase()} alternative ${year}`,
            `${competitor.name.toLowerCase()} vs tamias`,
            `switch from ${competitor.name.toLowerCase()}`,
            `${competitor.name.toLowerCase()} pricing`,
            `${competitor.name.toLowerCase()} competitor`,
            "business finance software",
            "invoicing software for founders",
            "expense tracking",
            "time tracking software",
            "founder tools",
            "small business software",
          ].join(", "),
        },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${baseUrl}/compare/${params.slug}` },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [
        {
          rel: "canonical",
          href: `${baseUrl}/compare/${params.slug}`,
        },
      ],
    };
  },
});
