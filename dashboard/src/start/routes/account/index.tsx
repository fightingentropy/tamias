import { createFileRoute } from "@tanstack/react-router";
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadAccountData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildAccountPageData } = await import("@/start/server/route-data/account");
  return await buildAccountPageData();
});

export const Route = createAppFileRoute("/account/")({
  loader: () => loadAccountData(),
  head: () => ({
    meta: [{ title: "Account Settings | Tamias" }],
  }),
});
