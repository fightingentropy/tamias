"use client";

import Image from "@/framework/image";
import type { Testimonial } from "../testimonial-data";
import { CloudflareStreamVideo } from "./cloudflare-stream-video";

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 6 18 18" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

export function VideoTestimonialModal({
  testimonial,
  onClose,
  zIndexClass = "z-50",
  contentZIndexClass = "z-50",
}: {
  testimonial: Testimonial;
  onClose: () => void;
  zIndexClass?: string;
  contentZIndexClass?: string;
}) {
  return (
    <div className={`fixed inset-0 flex items-center justify-center ${zIndexClass}`}>
      <div
        className="fixed inset-0 bg-white/40 backdrop-blur-sm dark:bg-black/40 transition-all duration-300 animate-in fade-in"
        onClick={onClose}
      />
      <div
        className={`relative bg-background border border-border p-8 max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto ${contentZIndexClass}`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6"
          aria-label="Close dialog"
        >
          <CloseIcon className="h-6 w-6 text-primary" />
        </button>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-left">
              {testimonial.country}
            </p>
            <div className="flex gap-3 items-center">
              {testimonial.image ? (
                <Image
                  src={testimonial.image}
                  alt={testimonial.name}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover"
                  style={{ filter: "grayscale(100%)" }}
                />
              ) : (
                <div className="w-6 h-6 bg-muted rounded-full" />
              )}
              <span className="font-sans text-sm text-foreground">
                {testimonial.name}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="w-full overflow-hidden bg-muted">
              <CloudflareStreamVideo
                src={testimonial.video}
                poster={testimonial.videoPoster}
                title={`${testimonial.name} video testimonial`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
