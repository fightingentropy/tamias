import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  PolicyPage,
  policyMetadata,
} from "@/site/pages/legal/policy-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/policy")({
  head: () => buildHeadFromMetadata(policyMetadata),
});
