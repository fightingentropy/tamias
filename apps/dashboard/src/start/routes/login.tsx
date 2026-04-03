import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { getAppUrl, getWebsiteUrl } from "@tamias/utils/envs";

const appUrl = getAppUrl();
const websiteUrl = getWebsiteUrl();

export const Route = createAppPublicFileRoute("/login")({
  head: () => ({
    meta: [
      {
        title: "Login | Tamias",
      },
    ],
  }),
});
