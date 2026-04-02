type SiteMetaValue =
  | string
  | URL
  | {
      url?: string | URL;
      alt?: string;
      default?: string | URL;
      absolute?: string | URL;
    };

export type SiteMetadata = {
  title?: string | SiteMetaValue;
  description?: string | SiteMetaValue;
  keywords?: string | string[];
  openGraph?: {
    title?: string | SiteMetaValue;
    description?: string | SiteMetaValue;
    type?: string;
    url?: string | URL;
    images?: SiteMetaValue | SiteMetaValue[];
  };
  twitter?: {
    card?: string;
    title?: string | SiteMetaValue;
    description?: string | SiteMetaValue;
    images?: SiteMetaValue | SiteMetaValue[];
  };
  alternates?: {
    canonical?: string | URL;
  };
};

export type SiteSitemapEntry = {
  url: string;
  lastModified?: string;
};
