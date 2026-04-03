import {
  getBlogPostPreviewBySlug,
  getPaginatedBlogPostPreviews,
  getSortedBlogPostPreviews,
  type BlogMetadataEntry,
} from "@/site/lib/blog-metadata";
import { blogContentBySlug } from "@/site/generated/blog-content";

export type { BlogMetadataEntry };
export type BlogPost = BlogMetadataEntry & { content: string };

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
