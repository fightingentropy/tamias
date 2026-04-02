import { createFileRoute } from "@tanstack/react-router";
import { CustomMDX } from "@/site/components/mdx";
import Image from "@/framework/image";
import Link from "@/framework/link";
import { PostAuthor } from "@/site/components/post-author";
import { getBlogPosts } from "@/site/lib/blog";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { SiteLayoutShell } from "@/start/root-shell";
import { baseUrl } from "@/site/sitemap";

export const Route = createFileRoute("/updates/$slug")({
  head: ({ params }) => {
    const post = getBlogPosts().find((entry) => entry.slug === params.slug);

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
  component: UpdatePage,
});

function UpdatePage() {
  const { slug } = Route.useParams();
  const post = getBlogPosts().find((entry) => entry.slug === slug);

  if (!post) {
    return <SiteNotFoundPage />;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.metadata.title,
    datePublished: post.metadata.publishedAt,
    dateModified: post.metadata.publishedAt,
    description: post.metadata.summary,
    image: post.metadata.image ? `${baseUrl}${post.metadata.image}` : undefined,
    url: `${baseUrl}/updates/${post.slug}`,
  };

  return (
    <SiteLayoutShell>
      <div className="container max-w-[1140px] flex justify-center">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />

        <article className="max-w-[680px] pt-[80px] md:pt-[150px] w-full pb-24">
          <Link
            href="/updates"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 inline-block"
          >
            ← Go back
          </Link>

          <h2 className="font-medium text-2xl mb-6">{post.metadata.title}</h2>

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

          <div className="mt-10">
            <PostAuthor author="pontus" />
          </div>
        </article>
      </div>
    </SiteLayoutShell>
  );
}
