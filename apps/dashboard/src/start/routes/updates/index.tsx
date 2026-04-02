import { createFileRoute } from "@tanstack/react-router";
import { CustomMDX } from "@/site/components/mdx";
import Image from "@/framework/image";
import Link from "@/framework/link";
import { Pagination } from "@/site/components/pagination";
import { PostStatus } from "@/site/components/post-status";
import { getBlogPosts } from "@/site/lib/blog";
import { SiteLayoutShell } from "@/start/root-shell";
import { baseUrl } from "@/site/sitemap";

const POSTS_PER_PAGE = 3;
const title = "Updates";
const description =
  "The latest updates and improvements to Tamias. See what we've been building to help you manage your business finances better.";

export const Route = createFileRoute("/updates/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${baseUrl}/updates` },
    ],
  }),
  component: UpdatesPage,
});

function UpdatesPage() {
  const allPosts = getBlogPosts().sort((a, b) => {
    if (new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)) {
      return -1;
    }

    return 1;
  });
  const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE);
  const posts = allPosts.slice(0, POSTS_PER_PAGE);

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
