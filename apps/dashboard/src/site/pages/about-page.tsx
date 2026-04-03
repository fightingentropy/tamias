import { createSiteMetadata } from "@/site/page-metadata";

export const aboutSiteMetadata = createSiteMetadata({
  title: "About",
  description:
    "About Tamias. Learn more about the team and company behind your AI-powered business assistant.",
  path: "/about",
});

export function AboutSitePage() {
  return <div>AboutPage</div>;
}
