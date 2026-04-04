import { createSiteFileRoute } from "@/start/route-hosts";
import { redirect, createFileRoute } from "@tanstack/react-router";
import { baseUrl } from "@/site/base-url";

const POSTS_PER_PAGE = 3;
const description =
  "The latest updates and improvements to Tamias. See what we've been building to help you manage your business finances better.";

export async function getPaginatedUpdatesPage(pageParam: string) {
  const currentPage = Number.parseInt(pageParam, 10);

  if (!Number.isFinite(currentPage) || currentPage < 1) {
    return {
      status: "not-found" as const,
    };
  }

  if (currentPage === 1) {
    return {
      status: "redirect" as const,
    };
  }

  const { getPaginatedBlogPostPreviews } = await import(
    "@/site/lib/blog-metadata"
  );
  const { posts, totalPages } = getPaginatedBlogPostPreviews(
    currentPage,
    POSTS_PER_PAGE,
  );

  if (currentPage > totalPages) {
    return {
      status: "not-found" as const,
    };
  }

  return {
    status: "ok" as const,
    currentPage,
    totalPages,
    posts,
  };
}

export const Route = createSiteFileRoute("/updates/page/$page")({
  loader: async ({ params }) => {
    const data = await getPaginatedUpdatesPage(params.page);

    if (data.status === "redirect") {
      throw redirect({
        to: "/updates",
        throw: true,
      });
    }

    return data;
  },
  head: ({ loaderData }) => {
    const data = loaderData;

    if (!data || data.status !== "ok") {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const currentPage = data.currentPage;
    const title = `Updates - Page ${currentPage}`;
    const url = `${baseUrl}/updates/page/${currentPage}`;

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
      links: [
        {
          rel: "canonical",
          href: url,
        },
      ],
    };
  },
});
