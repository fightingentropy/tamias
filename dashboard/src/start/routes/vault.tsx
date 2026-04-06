import { createFileRoute } from "@tanstack/react-router"
import { createAppFileRoute } from "@/start/route-hosts";
import { createServerFn } from "@tanstack/react-start";

export const loadVaultData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildVaultPageData } = await import(
      "@/start/server/route-data/vault"
    );
    return (await buildVaultPageData(data.href));
  });

export type VaultLoaderData = Awaited<ReturnType<typeof loadVaultData>>;

export const Route = createAppFileRoute("/vault")({
  loader: ({ location }) => loadVaultData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Vault | Tamias" }],
  }),
});
