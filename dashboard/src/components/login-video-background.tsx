"use client";

import { useEffect, useRef, useState } from "react";
import darkPosterSrc from "@/assets/login/bg-login-dark.jpg";
import posterSrc from "@/assets/login/bg-login.jpg";
import videoSrc from "@/assets/login/login-video.mp4";

const posterUrl = posterSrc.src;
const darkPosterUrl = darkPosterSrc.src;
const videoUrl = videoSrc.src;

function prefersReducedData() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-data: reduce)").matches;
}

export function LoginVideoBackground() {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (prefersReducedData()) {
      return;
    }

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleCallbackId = window.requestIdleCallback(() => {
        setShouldLoadVideo(true);
      });

      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = globalThis.setTimeout(() => {
      setShouldLoadVideo(true);
    }, 300);

    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      setIsVideoLoaded(true);
    };

    const handleLoadedData = () => {
      setIsVideoLoaded(true);
    };

    const handleCanPlayThrough = () => {
      setIsVideoLoaded(true);
    };

    if (video.readyState >= 3) {
      setIsVideoLoaded(true);
    }

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplaythrough", handleCanPlayThrough);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplaythrough", handleCanPlayThrough);
    };
  }, [shouldLoadVideo]);

  return (
    <div className="flex w-full h-full relative overflow-hidden m-2">
      <div
        className={`absolute inset-0 w-full h-full transition-all duration-1000 ease-in-out ${
          isVideoLoaded && !hasVideoError ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{
          filter: isVideoLoaded && !hasVideoError ? "blur(0px)" : "blur(1px)",
        }}
      >
        <img
          src={posterUrl}
          alt=""
          className="w-full h-full object-cover dark:hidden"
          aria-hidden="true"
        />
        <img
          src={darkPosterUrl}
          alt=""
          className="hidden w-full h-full object-cover dark:block"
          aria-hidden="true"
        />
      </div>

      {shouldLoadVideo ? (
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            isVideoLoaded && !hasVideoError ? "opacity-100" : "opacity-0"
          }`}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={posterUrl}
          onError={() => setHasVideoError(true)}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      ) : null}

      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex flex-col justify-center items-center p-2 text-center h-full w-full">
        <div className="max-w-lg">
          <div className="text-white/80 max-w-md">
            <p className="text-xl leading-relaxed">
              Due to improved invoice reconciliation, we are now saving 1-2 man-days each month, and
              we have a better understanding of our finances thanks to dashboards.
            </p>
            <p className="mt-4 text-xs text-white/60">Paweł Michalski, VC leaders • Poland</p>
          </div>
        </div>
      </div>
    </div>
  );
}
