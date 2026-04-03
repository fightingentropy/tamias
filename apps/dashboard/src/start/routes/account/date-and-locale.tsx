import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadAccountDateAndLocaleData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildAccountDateAndLocalePageData } = await import(
      "@/start/server/route-data/account"
    );
    return (await buildAccountDateAndLocalePageData()) as any;
  },
);

export const Route = createAppFileRoute("/account/date-and-locale")({
  loader: () => loadAccountDateAndLocaleData(),
  head: () => ({
    meta: [{ title: "Date & Locale | Tamias" }],
  }),
});
