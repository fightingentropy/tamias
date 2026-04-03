import { createAppPublicFileRoute } from "@/start/route-hosts";
import { redirect, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

export const loadShortLinkData = createServerFn({ method: "GET" })
  .inputValidator((data: { shortId: string }) => data)
  .handler(async ({ data }) => {
    const { buildShortLinkPageData } = await import(
      "@/start/server/route-data/public"
    );

    return (await buildShortLinkPageData(data.shortId)) as any;
  });

export const Route = createAppPublicFileRoute("/s/$shortId")({
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
});
