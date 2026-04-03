"use client";

function getCloudflareStreamEmbedUrl(src?: string, poster?: string) {
  if (!src) {
    return null;
  }

  try {
    const url = new URL(src);

    if (
      !url.hostname.endsWith(".cloudflarestream.com") ||
      !url.pathname.endsWith("/manifest/video.m3u8")
    ) {
      return null;
    }

    const embedUrl = new URL(
      url.pathname.replace(/\/manifest\/video\.m3u8$/, "/iframe"),
      `${url.protocol}//${url.host}`,
    );

    if (poster) {
      embedUrl.searchParams.set("poster", poster);
    }

    return embedUrl.toString();
  } catch {
    return null;
  }
}

interface CloudflareStreamVideoProps {
  src?: string;
  poster?: string;
  title: string;
  className?: string;
}

export function CloudflareStreamVideo({
  src,
  poster,
  title,
  className = "w-full h-auto aspect-video",
}: CloudflareStreamVideoProps) {
  const embedUrl = getCloudflareStreamEmbedUrl(src, poster);

  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title={title}
        loading="lazy"
        className={className}
        style={{ filter: "grayscale(100%)" }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
      />
    );
  }

  return (
    <video
      className={className}
      controls
      playsInline
      preload="metadata"
      poster={poster}
      style={{ filter: "grayscale(100%)" }}
    >
      {src ? <source src={src} /> : null}
      <track kind="captions" />
      Your browser does not support the video tag.
    </video>
  );
}
