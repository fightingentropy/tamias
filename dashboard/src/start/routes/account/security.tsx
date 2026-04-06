import { createFileRoute } from "@tanstack/react-router";
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadAccountSecurityData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildAccountSecurityPageData } = await import("@/start/server/route-data/account");
  return await buildAccountSecurityPageData();
});

export const Route = createAppFileRoute("/account/security")({
  loader: () => loadAccountSecurityData(),
  head: () => ({
    meta: [{ title: "Security | Tamias" }],
  }),
});
