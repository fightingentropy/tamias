import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { baseUrl } from "@/site/base-url";

export const Route = createSiteFileRoute("/integrations/category/$category")({
  loader: async ({ params }) => {
    const { categories } = await import("@/site/data/app-catalog");

    return categories.find(
      (category) => category.id === params.category,
    ) ?? null;
  },
  head: ({ params, loaderData }) => {
    const categoryData = loaderData;

    if (!categoryData) {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const title = `${categoryData.name} Integrations`;
    const description = `Connect Tamias with ${categoryData.name.toLowerCase()} tools. Explore our ${categoryData.name.toLowerCase()} integrations to streamline your financial workflow.`;
    const url = `${baseUrl}/integrations/category/${params.category}`;

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
