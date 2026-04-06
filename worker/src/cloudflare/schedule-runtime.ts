import type { CloudflareRecurringScheduleRequest } from "./bridge-helpers";
import type { CloudflareAsyncEnv } from "./shared";

export async function upsertRecurringScheduleInRunCoordinator(
  env: CloudflareAsyncEnv,
  payload: CloudflareRecurringScheduleRequest,
) {
  if (!env.RUN_COORDINATOR) {
    throw new Error("Run coordinator binding not configured");
  }

  const stub = env.RUN_COORDINATOR.getByName(payload.scheduleId);
  return stub.fetch("https://run-coordinator.internal/schedule", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function cancelRecurringScheduleInRunCoordinator(
  env: CloudflareAsyncEnv,
  scheduleId: string,
) {
  if (!env.RUN_COORDINATOR) {
    throw new Error("Run coordinator binding not configured");
  }

  const stub = env.RUN_COORDINATOR.getByName(scheduleId);
  return stub.fetch("https://run-coordinator.internal/schedule/cancel", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ scheduleId }),
  });
}

export function createCloudflareScheduleRuntime(env: CloudflareAsyncEnv) {
  if (!env.RUN_COORDINATOR) {
    return null;
  }

  return {
    upsertRecurringSchedule: async (
      request: CloudflareRecurringScheduleRequest,
    ) => {
      const response = await upsertRecurringScheduleInRunCoordinator(
        env,
        request,
      );

      if (!response.ok) {
        throw new Error("Failed to upsert Cloudflare recurring schedule");
      }
    },
    cancelRecurringSchedule: async (scheduleId: string) => {
      const response = await cancelRecurringScheduleInRunCoordinator(
        env,
        scheduleId,
      );

      if (!response.ok) {
        throw new Error("Failed to cancel Cloudflare recurring schedule");
      }

      const body = (await response.json().catch(() => null)) as {
        canceled?: boolean;
      } | null;

      return body?.canceled === true;
    },
  };
}
