"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookIcon } from "lucide-react";
import { getWebsiteFaviconUrl } from "@/utils/logos";
import { OpenURL } from "./open-url";

interface SourceItem {
  url: string;
  title: string;
}

interface FaviconStackProps {
  sources: SourceItem[];
}

/**
 * Modify URL to add utm_source=tamias.xyz and replace utm_source=openai if present
 */
function modifyUrlWithUtmSource(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove existing utm_source parameter if present
    urlObj.searchParams.delete("utm_source");

    // Add utm_source=tamias.xyz
    urlObj.searchParams.set("utm_source", "tamias.xyz");

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

export function FaviconStack({ sources }: FaviconStackProps) {
  if (sources.length === 0) return null;

  return (
    <div className="flex items-center not-prose mb-4">
      <div className="flex items-center">
        <AnimatePresence mode="popLayout">
          {sources.map((source, index) => (
            <motion.div
              key={source.url}
              initial={{
                opacity: 0,
                scale: 0.6,
                x: 50,
                filter: "blur(4px)",
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                filter: "blur(0px)",
                zIndex: sources.length - index,
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
                x: -20,
                filter: "blur(4px)",
              }}
              transition={{
                duration: 0.4,
                delay: index * 0.04,
                ease: [0.16, 1, 0.3, 1], // Custom easing for smooth motion
              }}
              className="relative -ml-2 first:ml-0"
              style={{ zIndex: sources.length - index }}
            >
              <OpenURL href={modifyUrlWithUtmSource(source.url)}>
                <div className="relative w-5 h-5 rounded-full bg-background border-2 border-border overflow-hidden flex items-center justify-center shadow-sm cursor-pointer">
                  <img
                    src={getWebsiteFaviconUrl(source.url, 32)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide image and show fallback icon
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      const fallback = parent?.querySelector(".fallback-icon") as HTMLElement;
                      if (fallback) fallback.style.display = "block";
                    }}
                  />
                  <BookIcon
                    className="fallback-icon w-3 h-3 hidden text-muted-foreground"
                    style={{ display: "none" }}
                  />
                </div>
              </OpenURL>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {sources.length > 0 && (
        <span className="text-xs text-muted-foreground ml-2">
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </span>
      )}
    </div>
  );
}
