import { createFileRoute } from "@tanstack/react-router";
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadAccountSupportData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildAccountSupportPageData } = await import("@/start/server/route-data/account");
  return await buildAccountSupportPageData();
});

export const Route = createAppFileRoute("/account/support")({
  loader: () => loadAccountSupportData(),
  head: () => ({
    meta: [{ title: "Support | Tamias" }],
  }),
});
