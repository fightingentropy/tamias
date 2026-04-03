import { Testimonials } from "@/site/components/testimonials";
import { createSiteMetadata } from "@/site/page-metadata";

export const testimonialsSiteMetadata = createSiteMetadata({
  title: "Customer Stories",
  description:
    "See how solo founders use Tamias to run their businesses with less admin.",
  path: "/testimonials",
  keywords: [
    "customer testimonials",
    "user stories",
    "tamias reviews",
    "customer success",
    "testimonials",
  ],
});

export function TestimonialsSitePage() {
  return <Testimonials />;
}
