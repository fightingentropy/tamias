import { createLazyFileRoute } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "@/framework/link";
import { AskAiBar } from "@/site/components/docs/ask-ai-bar";
import { FloatingChatInput } from "@/site/components/docs/floating-chat-input";
import { DocsMDX } from "@/site/components/docs/mdx";
import {
  docsNavigation,
  getAdjacentDocs,
  getDocBySlug,
} from "@/site/lib/docs";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/docs/$slug")({
  component: DocPage,
});

function DocPage() {
  const { slug } = Route.useParams();
  const doc = getDocBySlug(slug);

  if (!doc) {
    return <SiteNotFoundPage />;
  }

  const { prev, next } = getAdjacentDocs(slug);

  return (
    <SiteLayoutShell>
      <div className="min-h-[calc(100vh-200px)] pt-24 md:pt-32">
        <FloatingChatInput navigation={docsNavigation} />

        <div className="max-w-2xl mx-auto px-4 pb-32">
          <nav className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-12">
            <Link
              href="/docs"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </Link>
            <span>/</span>
            <span className="text-foreground">{doc.metadata.title}</span>
          </nav>

          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-serif tracking-tight text-foreground mb-4">
              {doc.metadata.title}
            </h1>
            {doc.metadata.description && (
              <p className="text-base lg:text-sm xl:text-base text-muted-foreground leading-relaxed">
                {doc.metadata.description}
              </p>
            )}
          </header>

          <article>
            <DocsMDX source={doc.content} />
          </article>

          <nav className="mt-20 pt-8 border-t border-border">
            <div className="flex items-center justify-between gap-4">
              {prev ? (
                <Link
                  href={`/docs/${prev.slug}`}
                  className="group flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="truncate">{prev.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {next ? (
                <Link
                  href={`/docs/${next.slug}`}
                  className="group flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors text-right"
                >
                  <span className="truncate">{next.title}</span>
                  <ChevronRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <div />
              )}
            </div>
          </nav>

          <div className="mt-8 pt-8 border-t border-border">
            <AskAiBar
              title={doc.metadata.title}
              description={doc.metadata.description}
            />
          </div>
        </div>
      </div>
    </SiteLayoutShell>
  );
}
