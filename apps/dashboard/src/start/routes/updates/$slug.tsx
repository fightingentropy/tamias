import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { getBlogPostPreviewBySlug } from "@/site/lib/blog";
import { baseUrl } from "@/site/sitemap";

export const Route = createSiteFileRoute("/updates/$slug")({
  head: ({ params }) => {
    const post = getBlogPostPreviewBySlug(params.slug);

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
