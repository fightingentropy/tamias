import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StartPage } from "@/site/components/startpage";
import { SiteLayoutShell } from "@/start/root-shell";

const loadIndexRoute = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveIndexRoute } = await import("@/start/server/route-data");
  return resolveIndexRoute();
});

export const Route = createFileRoute("/")({
  loader: () => loadIndexRoute(),
  component: IndexPage,
});

function IndexPage() {
  return (
    <SiteLayoutShell>
      <StartPage />
    </SiteLayoutShell>
  );
}
