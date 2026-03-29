interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

const CDN_URL = "https://tamias.xyz";

export default function imageLoader({
  src,
  width,
  quality = 80,
}: ImageLoaderParams): string {
  // Cloudflare image resizing returns 404s for same-origin static assets.
  // Serve local assets directly and reserve the CDN transform for remote URLs.
  if (src.startsWith("/")) {
    return src;
  }

  // Skip CDN optimization for localhost (local development)
  if (src.includes("localhost") || src.includes("127.0.0.1")) {
    return src;
  }

  // In development, serve local images without CDN
  if (process.env.NODE_ENV === "development") {
    if (src.startsWith("/")) {
      return `${src}?w=${width}&q=${quality}`;
    }
    return src;
  }

  // In preview, skip Cloudflare CDN (not available on preview URLs)
  const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;

  if (isPreview && vercelUrl) {
    if (src.startsWith("/")) {
      return `https://${vercelUrl}${src}`;
    }
    return src;
  }

  return `${CDN_URL}/cdn-cgi/image/width=${width},quality=${quality}/${src}`;
}
