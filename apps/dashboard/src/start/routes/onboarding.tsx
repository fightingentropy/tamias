import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadOnboardingData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildOnboardingPageData } = await import(
      "@/start/server/route-data/misc"
    );
    return (await buildOnboardingPageData()) as any;
  },
);

export const Route = createAppFileRoute("/onboarding")({
  loader: () => loadOnboardingData(),
  head: () => ({
    meta: [{ title: "Onboarding | Tamias" }],
  }),
});
