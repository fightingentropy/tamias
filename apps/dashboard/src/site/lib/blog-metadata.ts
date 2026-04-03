import {
  blogEntries,
  type BlogMetadataEntry,
} from "@/site/generated/blog-metadata";

export type { BlogMetadataEntry };

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

export function getPaginatedBlogPostPreviews(page: number, postsPerPage: number) {
  const posts = getSortedBlogPostPreviews();
  const totalPages = Math.ceil(posts.length / postsPerPage);
  const startIndex = (page - 1) * postsPerPage;

  return {
    totalPages,
    posts: posts.slice(startIndex, startIndex + postsPerPage),
  };
}
