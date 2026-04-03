import { createLazyFileRoute } from "@tanstack/react-router";
import { CustomMDX } from "@/site/components/mdx";
import { Pagination } from "@/site/components/pagination";
import { PostStatus } from "@/site/components/post-status";
import Image from "@/framework/image";
import Link from "@/framework/link";
import { getBlogPostsBySlugs } from "@/site/lib/blog";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";
import { getPaginatedUpdatesPage } from "./$page";

export const Route = createLazyFileRoute("/updates/page/$page")({
  component: PaginatedUpdatesPage,
});

function PaginatedUpdatesPage() {
  const { page } = Route.useParams();
  const data = getPaginatedUpdatesPage(page);

  if (data.status !== "ok") {
    return <SiteNotFoundPage />;
  }

  const { currentPage, posts: previews, totalPages } = data;
  const posts = getBlogPostsBySlugs(previews.map((post) => post.slug));

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
