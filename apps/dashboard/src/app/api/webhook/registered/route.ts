import * as crypto from "node:crypto";
import { LogEvents } from "@tamias/events/events";
import { setupAnalytics } from "@tamias/events/server";
import { startCloudflareWorkflow } from "@tamias/job-client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { configureDashboardAsyncWorkerRuntime } from "@/server/cloudflare-async-worker";

export const dynamic = "force-dynamic";
const SIGNATURE_HEADER = "x-webhook-signature";

// NOTE: This endpoint is triggered by the registration database webhook.
export async function POST(req: Request) {
  configureDashboardAsyncWorkerRuntime();
  const text = await req.clone().text();
  const signature = (await headers()).get(SIGNATURE_HEADER);

  if (!signature) {
    return NextResponse.json({ message: "Missing signature" }, { status: 401 });
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
    return NextResponse.json({ message: "Not Authorized" }, { status: 401 });
  }

  const body = await req.json();

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

  return NextResponse.json({ success: true });
}
