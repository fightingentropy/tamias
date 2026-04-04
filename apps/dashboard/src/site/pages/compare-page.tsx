"use client";

import { Button } from "@tamias/ui/button";
import Link from "@/framework/link";
import { competitors } from "@/site/data/competitors";
import { useSiteLoginUrl } from "@/site/login-url";

export function CompareSitePage() {
  const loginUrl = useSiteLoginUrl();

  return (
    <div className="min-h-screen pt-24 sm:pt-28 lg:pt-32 pb-24">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-4">
            Compare Tamias to alternatives
          </h1>
          <p className="font-sans text-base text-muted-foreground max-w-2xl mx-auto">
            Tamias is built for founders and small teams who want clarity over
            their finances without the complexity of traditional accounting
            software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {competitors.map((competitor) => (
            <Link
              key={competitor.id}
              href={`/compare/${competitor.slug}`}
              className="border border-border p-6 hover:border-foreground/20 transition-all duration-200"
            >
              <h2 className="font-sans text-lg text-foreground mb-2">
                {competitor.name} Alternative
              </h2>
              <p className="font-sans text-sm text-muted-foreground mb-4 line-clamp-2">
                {competitor.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {competitor.keyDifferences.slice(0, 2).map((difference) => (
                  <span
                    key={difference.title}
                    className="font-sans text-xs text-muted-foreground bg-muted px-2 py-1"
                  >
                    {difference.tamias}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-background border border-border p-8 lg:p-12 text-center relative before:absolute before:inset-0 before:bg-[repeating-linear-gradient(-60deg,rgba(219,219,219,0.4),rgba(219,219,219,0.4)_1px,transparent_1px,transparent_6px)] dark:before:bg-[repeating-linear-gradient(-60deg,rgba(44,44,44,0.4),rgba(44,44,44,0.4)_1px,transparent_1px,transparent_6px)] before:pointer-events-none">
          <div className="relative z-10">
            <h2 className="font-serif text-2xl text-foreground mb-4">
              Ready to try Tamias?
            </h2>
            <p className="font-sans text-base text-muted-foreground mb-6 max-w-xl mx-auto">
              Start your 14-day free trial and see why founders are switching to
              Tamias.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="btn-inverse h-11 px-6">
                <Link href={loginUrl}>Start your free trial</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 px-6">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
