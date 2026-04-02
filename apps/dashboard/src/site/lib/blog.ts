import { blogPosts, type BlogPost } from "@/site/generated/content-manifest";

export type { BlogPost };

export function getBlogPosts() {
  return blogPosts;
}
