import { createLazyFileRoute } from "@tanstack/react-router";
import { CustomMDX } from "@/site/components/mdx";
import { Pagination } from "@/site/components/pagination";
import { PostStatus } from "@/site/components/post-status";
import Image from "@/framework/image";
import Link from "@/framework/link";
import { getBlogPostsBySlugs, getPaginatedBlogPostPreviews } from "@/site/lib/blog";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

const POSTS_PER_PAGE = 3;

export const Route = createLazyFileRoute("/updates/")({
  component: UpdatesPage,
});

function UpdatesPage() {
  const { posts: previews, totalPages } = getPaginatedBlogPostPreviews(
    1,
    POSTS_PER_PAGE,
  );
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

          <Pagination currentPage={1} totalPages={totalPages} basePath="/updates" />
        </div>
      </div>
    </SiteLayoutShell>
  );
}
