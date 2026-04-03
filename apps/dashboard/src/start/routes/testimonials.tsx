import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  TestimonialsSitePage,
  testimonialsSiteMetadata,
} from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/testimonials")({
  head: () => buildHeadFromMetadata(testimonialsSiteMetadata),
});
