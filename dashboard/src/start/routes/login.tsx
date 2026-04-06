/** TanStack file-route modules conventionally import createFileRoute */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createAppPublicFileRoute } from "@/start/route-hosts";

export const loadLoginRoute = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveLoginRoute } = await import("@/start/server/route-data/login");
  await resolveLoginRoute();
});

export const Route = createAppPublicFileRoute("/login")({
  loader: () => loadLoginRoute(),
  head: () => ({
    meta: [
      {
        title: "Login | Tamias",
      },
    ],
  }),
});
