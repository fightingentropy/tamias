import type { SiteMetadata } from "@/site/metadata";

function resolveText(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    const items = value
      .map((entry) => resolveText(entry))
      .filter((entry): entry is string => Boolean(entry));

    return items.length > 0 ? items.join(", ") : undefined;
  }

  if (value && typeof value === "object") {
    if ("url" in value) {
      return resolveText((value as { url?: unknown }).url);
    }

    if ("default" in value) {
      return resolveText((value as { default?: unknown }).default);
    }

    if ("absolute" in value) {
      return resolveText((value as { absolute?: unknown }).absolute);
    }
  }

  return undefined;
}

function resolveFirstImage(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const resolved = resolveText(entry);

      if (resolved) {
        return resolved;
      }
    }

    return undefined;
  }

  return resolveText(value);
}

export function buildHeadFromMetadata(metadata?: Partial<SiteMetadata> | null) {
  const openGraph = metadata?.openGraph as
    | ({ type?: unknown; title?: unknown; description?: unknown; url?: unknown; images?: unknown })
    | undefined;
  const twitter = metadata?.twitter as
    | ({ card?: unknown; title?: unknown; description?: unknown; images?: unknown })
    | undefined;
  const title = resolveText(metadata?.title);
  const description = resolveText(metadata?.description);
  const keywords = resolveText(metadata?.keywords);
  const openGraphTitle = resolveText(openGraph?.title) ?? title;
  const openGraphDescription =
    resolveText(openGraph?.description) ?? description;
  const openGraphUrl = resolveText(openGraph?.url);
  const openGraphType = resolveText(openGraph?.type) ?? "website";
  const openGraphImage = resolveFirstImage(openGraph?.images);
  const twitterCard =
    resolveText(twitter?.card) ??
    (openGraphImage ? "summary_large_image" : "summary");
  const twitterTitle = resolveText(twitter?.title) ?? title;
  const twitterDescription =
    resolveText(twitter?.description) ?? description;
  const twitterImage = resolveFirstImage(twitter?.images) ?? openGraphImage;
  const canonical = resolveText(metadata?.alternates?.canonical);

  const meta = [
    title ? ({ title } as const) : null,
    description ? ({ name: "description", content: description } as const) : null,
    keywords ? ({ name: "keywords", content: keywords } as const) : null,
    openGraphTitle
      ? ({ property: "og:title", content: openGraphTitle } as const)
      : null,
    openGraphDescription
      ? ({ property: "og:description", content: openGraphDescription } as const)
      : null,
    openGraphType
      ? ({ property: "og:type", content: openGraphType } as const)
      : null,
    openGraphUrl
      ? ({ property: "og:url", content: openGraphUrl } as const)
      : null,
    openGraphImage
      ? ({ property: "og:image", content: openGraphImage } as const)
      : null,
    twitterCard ? ({ name: "twitter:card", content: twitterCard } as const) : null,
    twitterTitle
      ? ({ name: "twitter:title", content: twitterTitle } as const)
      : null,
    twitterDescription
      ? ({ name: "twitter:description", content: twitterDescription } as const)
      : null,
    twitterImage
      ? ({ name: "twitter:image", content: twitterImage } as const)
      : null,
  ].filter((entry) => entry !== null);

  return {
    meta,
    links: canonical ? [{ rel: "canonical", href: canonical }] : undefined,
  };
}

export function stringifyJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function JsonLdScript(props: { value: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: stringifyJsonLd(props.value),
      }}
    />
  );
}
