"use client";

import Image from "@/framework/image";
import { allTestimonials } from "./testimonial-data";
import { CloudflareStreamVideo } from "./sections/cloudflare-stream-video";

function renderStructuredContent(content: string) {
  const sections = content.split("\n\n");
  const structured: { label: string; text: string }[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]?.trim();
    if (!section) continue;

    const lines = section.split("\n");
    const firstLine = lines[0]?.trim();

    if (!firstLine) continue;

    if (
      firstLine.length < 30 &&
      /^[A-Z][a-z\s]+$/.test(firstLine) &&
      lines.length > 1
    ) {
      structured.push({
        label: firstLine,
        text: lines.slice(1).join("\n").trim(),
      });
    } else {
      if (structured.length > 0) {
        const lastSection = structured[structured.length - 1];
        if (lastSection) {
          lastSection.text = `${lastSection.text}\n\n${section}`;
        }
      } else {
        structured.push({ label: "", text: section });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {structured.map((section) => (
        <div
          key={section.label || section.text.slice(0, 20)}
          className="flex flex-col gap-2"
        >
          {section.label && (
            <p className="font-sans text-sm font-medium text-foreground">
              {section.label}
            </p>
          )}
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            {section.text}
          </p>
        </div>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-background pt-32 pb-24">
        <div className="max-w-[1400px] mx-auto mb-16 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-4">
              Customer Stories
            </h1>
            <p className="font-sans text-base text-muted-foreground leading-normal mb-8">
              See how solo founders use Tamias to run their businesses with
              less admin.
            </p>
          </div>
        </div>
        <div className="max-w-[1400px] mx-auto">
          <div className="h-px w-full border-t border-border" />
        </div>
      </div>

      {/* Testimonials List */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-12 sm:pb-16 lg:pb-24">
        <div className="space-y-16 sm:space-y-20 lg:space-y-24">
          {allTestimonials.map((testimonial, index) => (
            <div
              key={`testimonial-${testimonial.name}-${index}`}
              className={
                index === 0
                  ? ""
                  : "border-t border-border pt-12 sm:pt-16 lg:pt-20"
              }
            >
              <div className="max-w-3xl mx-auto space-y-8 sm:space-y-10">
                {/* Quote Section */}
                <div className="space-y-6">
                  {/* Author Info */}
                  <div className="flex items-center gap-3">
                    {testimonial.image && (
                      <Image
                        src={testimonial.image}
                        alt={testimonial.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        style={{ filter: "grayscale(100%)" }}
                      />
                    )}
                    <div className="flex flex-col gap-1">
                      <h2 className="font-sans text-base sm:text-lg font-medium text-foreground">
                        {testimonial.name}
                      </h2>
                      <p className="font-sans text-sm text-muted-foreground">
                        {testimonial.company}
                        {testimonial.country && (
                          <span className="text-muted-foreground/70">
                            {" "}
                            · {testimonial.country}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Big Quote */}
                  <blockquote className="font-sans text-lg sm:text-xl lg:text-2xl text-foreground leading-normal sm:leading-relaxed">
                    &quot;{testimonial.content}&quot;
                  </blockquote>
                </div>

                {/* Divider */}
                <div className="h-px w-full border-t border-border" />

                {/* Full Content */}
                <div className="space-y-6">
                  {renderStructuredContent(testimonial.fullContent)}
                </div>

                {/* Video if available */}
                {testimonial.video && (
                  <div className="w-full overflow-hidden bg-muted border border-border">
                    <CloudflareStreamVideo
                      src={testimonial.video}
                      poster={testimonial.videoPoster}
                      title={`${testimonial.name} video testimonial`}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
