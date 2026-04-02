import { createFileRoute, redirect } from "@tanstack/react-router";
import { CustomMDX } from "@/site/components/mdx";
import Image from "@/framework/image";
import Link from "@/framework/link";
import { Pagination } from "@/site/components/pagination";
import { PostStatus } from "@/site/components/post-status";
import { getBlogPosts } from "@/site/lib/blog";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { baseUrl } from "@/site/sitemap";
import { SiteLayoutShell } from "@/start/root-shell";

const POSTS_PER_PAGE = 3;
const description =
  "The latest updates and improvements to Tamias. See what we've been building to help you manage your business finances better.";

function getPaginatedUpdatesPage(pageParam: string) {
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

  const allPosts = getBlogPosts().sort((a, b) => {
    if (new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)) {
      return -1;
    }

    return 1;
  });
  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);

  if (currentPage > totalPages) {
    return {
      status: "not-found" as const,
    };
  }

  const startIndex = (currentPage - 1) * POSTS_PER_PAGE;

  return {
    status: "ok" as const,
    currentPage,
    totalPages,
    posts: allPosts.slice(startIndex, startIndex + POSTS_PER_PAGE),
  };
}

export const Route = createFileRoute("/updates/page/$page")({
  loader: ({ params }) => {
    const data = getPaginatedUpdatesPage(params.page);

    if (data.status === "redirect") {
      throw redirect({
        to: "/updates",
        throw: true,
      });
    }
  },
  head: ({ params }) => {
    const data = getPaginatedUpdatesPage(params.page);

    if (data.status !== "ok") {
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
  component: PaginatedUpdatesPage,
});

function PaginatedUpdatesPage() {
  const { page } = Route.useParams();
  const data = getPaginatedUpdatesPage(page);

  if (data.status !== "ok") {
    return <SiteNotFoundPage />;
  }

  const { currentPage, posts, totalPages } = data;

  return (
    <SiteLayoutShell>
      <div className="container flex flex-col items-center">
        <div className="max-w-[680px] pt-[80px] md:pt-[150px] w-full">
          {posts.map((post) => (
            <article key={post.slug} className="mb-20">
              <PostStatus status={post.metadata.tag} />

              <Link className="mb-6 block" href={`/updates/${post.slug}`}>
                <h2 className="font-medium text-2xl mb-6">
                  {post.metadata.title}
                </h2>
              </Link>

              <div className="updates">
                {post.metadata.image && (
                  <Image
                    src={post.metadata.image}
                    alt={post.metadata.title}
                    width={680}
                    height={442}
                    className="mb-12"
                  />
                )}

                <CustomMDX source={post.content} />
              </div>
            </article>
          ))}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/updates"
          />
        </div>
      </div>
    </SiteLayoutShell>
  );
}
