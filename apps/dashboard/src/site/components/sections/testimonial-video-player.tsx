"use client";

import type Hls from "hls.js";
import { useEffect, useRef } from "react";

interface TestimonialVideoPlayerProps {
  poster?: string;
  src?: string;
}

export function TestimonialVideoPlayer({
  src,
  poster,
}: TestimonialVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let mounted = true;

    void import("hls.js").then(({ default: HlsModule }) => {
      if (!mounted || !video || !HlsModule.isSupported()) {
        return;
      }

      const hls = new HlsModule();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    });

    return () => {
      mounted = false;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className="w-full h-auto"
      controls
      playsInline
      preload="metadata"
      poster={poster}
      style={{ filter: "grayscale(100%)" }}
    >
      <track kind="captions" />
      Your browser does not support the video tag.
    </video>
  );
}
