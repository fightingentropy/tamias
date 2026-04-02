import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { NotFoundPage } from "@/start/components/not-found-page";
import { formatSize } from "@/utils/format";

const loadShortLinkData = createServerFn({ method: "GET" })
  .inputValidator((data: { shortId: string }) => data)
  .handler(async ({ data }) => {
    const { buildShortLinkPageData } = await import("@/start/server/route-data");

    return (await buildShortLinkPageData(data.shortId)) as any;
  });

export const Route = createFileRoute("/s/$shortId")({
  loader: async ({ params }) => {
    const data = await loadShortLinkData({
      data: {
        shortId: params.shortId,
      },
    });

    if (data.status === "redirect") {
      throw redirect({
        href: data.href,
        throw: true,
      });
    }

    return data;
  },
  head: () => ({
    meta: [{ name: "robots", content: "noindex,nofollow" }],
  }),
  component: ShortLinkPage,
});

function ShortLinkPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadShortLinkData>
  >;

  if (loaderData.status !== "ok") {
    return <NotFoundPage />;
  }

  const { shortLink } = loaderData;

  return (
    <div className="h-screen p-2">
      <header className="absolute top-0 left-0 z-30 w-full">
        <div className="p-6">
          <Icons.LogoSmall className="h-6 w-auto" />
        </div>
      </header>

      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-[400px]">
          <div className="text-center">
            <h1 className="text-lg mb-2 font-serif">Download File</h1>

            <p className="text-[#878787] text-sm mb-8">
              {shortLink.teamName} has shared a file with you
            </p>
          </div>

          <div className="space-y-4">
            <div className="border-b-[1px] border-border mb-4 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground truncate">
                  {shortLink.fileName?.split("/").pop() ?? "File"}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {shortLink.size ? formatSize(shortLink.size) : null}
                </p>
              </div>
            </div>

            <a href={shortLink.url} rel="noreferrer" download>
              <Button className="w-full mt-6" size="lg">
                <div className="flex items-center space-x-2">
                  <span>Download File</span>
                  <Icons.ArrowCoolDown className="size-4" />
                </div>
              </Button>
            </a>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            This download link is secure and will expire.
          </p>
        </div>
      </div>
    </div>
  );
}
