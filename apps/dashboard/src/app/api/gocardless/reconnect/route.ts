import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { getTRPCClient } from "@/trpc/server";
import { getUrl } from "@/utils/environment";

export async function GET(req: NextRequest) {
  const origin = getUrl();
  const token = await convexAuthNextjsToken();

  if (!token) {
    return NextResponse.redirect(new URL("/", origin));
  }

  const requestUrl = new URL(req.url);
  const id = requestUrl.searchParams.get("id");
  const referenceId = requestUrl.searchParams.get("reference_id") ?? undefined;
  const accessValidForDays = Number(
    requestUrl.searchParams.get("access_valid_for_days"),
  );

  if (id) {
    const trpc = await getTRPCClient();

    await trpc.bankConnections.updateReconnectById.mutate({
      id,
      referenceId,
      accessValidForDays: accessValidForDays || 180,
    });
  }

  return NextResponse.redirect(
    `${origin}/settings/accounts?id=${id}&step=reconnect`,
  );
}
