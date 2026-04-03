import type { SiteMetadata } from "@/site/metadata";
import { baseUrl } from "@/site/base-url";

type SiteMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
};

export function createSiteMetadata({
  title,
  description,
  path,
  keywords,
  image,
  imageAlt,
  type = "website",
}: SiteMetadataOptions): SiteMetadata {
  const url = `${baseUrl}${path}`;
  const images = image
    ? [
        {
          url: image,
          alt: imageAlt ?? title,
        },
      ]
    : undefined;

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type,
      url,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
    alternates: {
      canonical: url,
    },
  };
}
