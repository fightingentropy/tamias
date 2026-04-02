import * as crypto from "node:crypto";
import { LogEvents } from "@tamias/events/events";
import { setupAnalytics } from "@tamias/events/server";
import { startCloudflareWorkflow } from "@tamias/job-client";
import { createFileRoute } from "@tanstack/react-router";
import { configureDashboardAsyncWorkerRuntime } from "@/server/cloudflare-async-worker";

const SIGNATURE_HEADER = "x-webhook-signature";

export const Route = createFileRoute("/api/webhook/registered")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await configureDashboardAsyncWorkerRuntime();

        const text = await request.clone().text();
        const signature = request.headers.get(SIGNATURE_HEADER);

        if (!signature) {
          return Response.json({ message: "Missing signature" }, { status: 401 });
        }

        const decodedSignature = Buffer.from(signature, "base64");
        const calculatedSignature = crypto
          .createHmac("sha256", process.env.WEBHOOK_SECRET_KEY!)
          .update(text)
          .digest();
        const hmacMatch = crypto.timingSafeEqual(
          decodedSignature,
          calculatedSignature,
        );

        if (!hmacMatch) {
          return Response.json({ message: "Not Authorized" }, { status: 401 });
        }

        const body = await request.json();
        const email = body.record.email;
        const analytics = await setupAnalytics();

        analytics.track({
          event: LogEvents.Registered.name,
          channel: LogEvents.Registered.channel,
        });

        const workflowInstanceId = `onboard-team-${crypto
          .createHash("sha256")
          .update(email)
          .digest("hex")
          .slice(0, 24)}`;

        await startCloudflareWorkflow(
          "onboard-team",
          {
            email,
          } satisfies { email: string },
          {
            instanceId: workflowInstanceId,
          },
        );

        return Response.json({ success: true });
      },
    },
  },
});
