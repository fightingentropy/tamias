import {
  blogContentBySlug,
  blogEntries,
  type BlogMetadataEntry,
} from "@/site/generated/content-manifest";

export type { BlogMetadataEntry };
export type BlogPost = BlogMetadataEntry & { content: string };

function comparePublishedAtDesc(
  left: { metadata: { publishedAt: string } },
  right: { metadata: { publishedAt: string } },
) {
  if (new Date(left.metadata.publishedAt) > new Date(right.metadata.publishedAt)) {
    return -1;
  }

  return 1;
}

export function getSortedBlogPostPreviews() {
  return [...blogEntries].sort(comparePublishedAtDesc);
}

export function getBlogPostPreviewBySlug(slug: string) {
  return blogEntries.find((post) => post.slug === slug) ?? null;
}

export function getBlogPostBySlug(slug: string) {
  const post = getBlogPostPreviewBySlug(slug);

  if (!post) {
    return null;
  }

  return {
    ...post,
    content: blogContentBySlug[slug] ?? "",
  };
}

export function getBlogPostsBySlugs(slugs: string[]) {
  return slugs
    .map((slug) => getBlogPostBySlug(slug))
    .filter((post): post is BlogPost => post !== null);
}

export function getPaginatedBlogPostPreviews(page: number, postsPerPage: number) {
  const posts = getSortedBlogPostPreviews();
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const startIndex = (page - 1) * postsPerPage;

  return {
    totalPages,
    posts: posts.slice(startIndex, startIndex + postsPerPage),
  };
}
