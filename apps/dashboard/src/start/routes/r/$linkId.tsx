import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import {
  HydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getAppUrl } from "@tamias/utils/envs";
import { PublicMetricView } from "@/components/public-metric-view";
import Link from "@/framework/link";
import { NotFoundPage } from "@/start/components/not-found-page";

const appUrl = getAppUrl();

const loadPublicReportData = createServerFn({ method: "GET" })
  .inputValidator((data: { linkId: string }) => data)
  .handler(async ({ data }) => {
    const { buildPublicReportPageData } = await import(
      "@/start/server/route-data"
    );

    return (await buildPublicReportPageData(data.linkId)) as any;
  });

export const Route = createFileRoute("/r/$linkId")({
  loader: ({ params }) =>
    loadPublicReportData({
      data: {
        linkId: params.linkId,
      },
    }),
  head: ({ loaderData }) => {
    const data = loaderData as Awaited<
      ReturnType<typeof loadPublicReportData>
    > | null | undefined;

    if (!data || data.status !== "ok") {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const imageUrl = `${appUrl}/r/${data.report.linkId}/opengraph-image`;

    return {
      meta: [
        { title: data.metadata.title },
        {
          name: "description",
          content: data.metadata.description,
        },
        { name: "robots", content: "noindex,nofollow" },
        { property: "og:title", content: data.metadata.title },
        {
          property: "og:description",
          content: data.metadata.description,
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${appUrl}/r/${data.report.linkId}` },
        { property: "og:image", content: imageUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: data.metadata.title },
        { name: "twitter:description", content: data.metadata.description },
        { name: "twitter:image", content: imageUrl },
      ],
    };
  },
  component: PublicReportPage,
});

function PublicReportPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadPublicReportData>
  >;

  if (loaderData.status !== "ok") {
    return <NotFoundPage />;
  }

  return (
    <HydrationBoundary
      state={
        loaderData.dehydratedState as unknown as
          | DehydratedState
          | null
          | undefined
      }
    >
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border">
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex-shrink-0">
                <Icons.LogoSmall className="h-6 w-auto" />
              </div>

              <div className="flex-1 flex items-center justify-center">
                <h1 className="text-sm">{loaderData.teamName}</h1>
              </div>

              <div className="flex-shrink-0">
                <Button variant="outline" asChild>
                  <Link href="/login">Login</Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-[1600px] mx-auto px-4 md:px-8 py-8 w-full flex items-center justify-center">
          <div className="w-full max-w-7xl">
            <PublicMetricView
              report={loaderData.report}
              chartName={loaderData.chartName}
              dateRangeDisplay={loaderData.dateRangeDisplay}
            />
          </div>
        </main>

        <footer className="mt-auto">
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
            <p className="text-center text-xs text-muted-foreground">
              Powered by{" "}
              <a
                href="https://tamias.xyz"
                className="hover:text-foreground transition-colors"
              >
                Tamias
              </a>
            </p>
          </div>
        </footer>
      </div>
    </HydrationBoundary>
  );
}
