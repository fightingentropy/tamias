import { Link } from "@tanstack/react-router";

type NotFoundPageProps = {
  description?: string;
  homeLabel?: string;
  homeTo?: string;
  fullScreen?: boolean;
};

export function NotFoundPage({
  description = "The page you requested does not exist.",
  homeLabel = "Go home",
  homeTo = "/",
  fullScreen = true,
}: NotFoundPageProps) {
  const content = (
    <div className="max-w-md space-y-4 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
        404
      </p>
      <h1 className="text-3xl font-serif text-foreground">Page not found</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link
        to={homeTo}
        className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
      >
        {homeLabel}
      </Link>
    </div>
  );

  if (fullScreen) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        {content}
      </main>
    );
  }

  return (
    <section className="flex min-h-[60vh] items-center justify-center py-24">
      {content}
    </section>
  );
}
