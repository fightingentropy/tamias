import { createFileRoute } from "@tanstack/react-router";
import * as crypto from "node:crypto";
import { LogEvents } from "@/lib/telemetry/events";
import { setupAnalytics } from "@/lib/telemetry/server";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { getTRPCClient } from "@/trpc/server";

const SIGNATURE_HEADER = "x-webhook-signature";

export const Route = createAppPublicFileRoute("/api/webhook/registered")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
        const hmacMatch = crypto.timingSafeEqual(decodedSignature, calculatedSignature);

        if (!hmacMatch) {
          return Response.json({ message: "Not Authorized" }, { status: 401 });
        }

        const bodyRaw: unknown = await request.json();
        if (bodyRaw === null || typeof bodyRaw !== "object" || !("record" in bodyRaw)) {
          return Response.json({ message: "Invalid body" }, { status: 400 });
        }
        const record = (bodyRaw as { record: unknown }).record;
        if (
          record === null ||
          typeof record !== "object" ||
          !("email" in record) ||
          typeof (record as { email: unknown }).email !== "string"
        ) {
          return Response.json({ message: "Invalid record" }, { status: 400 });
        }
        const email = (record as { email: string }).email;
        const analytics = await setupAnalytics();

        analytics.track({
          event: LogEvents.Registered.name,
          channel: LogEvents.Registered.channel,
        });

        const trpc = await getTRPCClient();
        await trpc.team.startOnboardingWorkflow.mutate({ email });

        return Response.json({ success: true });
      },
    },
  },
});
