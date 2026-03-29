import { blogPosts, type BlogPost } from "@/generated/content-manifest";

export type { BlogPost };

export function getBlogPosts() {
  return blogPosts;
}
