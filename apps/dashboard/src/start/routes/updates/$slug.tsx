import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { baseUrl } from "@/site/base-url";

export const Route = createSiteFileRoute("/updates/$slug")({
  loader: async ({ params }) => {
    const { getBlogPostPreviewBySlug } = await import("@/site/lib/blog-metadata");

    return getBlogPostPreviewBySlug(params.slug);
  },
  head: ({ params, loaderData }) => {
    const post = loaderData;

    if (!post) {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    return {
      meta: [
        { title: post.metadata.title },
        { name: "description", content: post.metadata.summary },
        { property: "og:title", content: post.metadata.title },
        { property: "og:description", content: post.metadata.summary },
        {
          property: "og:url",
          content: `${baseUrl}/updates/${post.slug}`,
        },
      ],
    };
  },
});
