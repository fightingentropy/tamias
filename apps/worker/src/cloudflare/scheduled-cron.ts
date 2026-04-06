import { getScheduledCloudflareMessages } from "./bridge-helpers";
import { getQueueBinding } from "./queue-bindings";
import type { CloudflareAsyncEnv } from "./shared";
import { configureWorkerRuntime } from "./worker-runtime";

export type ScheduledControllerLike = {
  cron?: string;
  scheduledTime?: number;
};

export async function handleAsyncWorkerScheduled(
  controller: ScheduledControllerLike,
  env: CloudflareAsyncEnv,
) {
  configureWorkerRuntime(env);
  const { logger } = await import("./shared");
  const messages = controller.cron
    ? getScheduledCloudflareMessages(controller.cron, controller.scheduledTime)
    : [];

  if (!messages.length) {
    logger.info("Skipping unsupported Cloudflare scheduled trigger", {
      cron: controller.cron ?? "unknown",
      scheduledTime: controller.scheduledTime ?? null,
    });
    return;
  }

  for (const message of messages) {
    const queueBinding = getQueueBinding(env, message.queue);
    if (!queueBinding) {
      logger.error("Missing Cloudflare queue binding for scheduled job", {
        cron: controller.cron ?? "unknown",
        queue: message.queue,
        queueName: message.queueName,
        jobName: message.jobName,
      });
      continue;
    }

    await queueBinding.send(message, {
      contentType: "json",
    });

    logger.info("Cloudflare scheduled trigger fired", {
      cron: controller.cron ?? "unknown",
      scheduledTime: controller.scheduledTime ?? null,
      queue: message.queue,
      queueName: message.queueName,
      jobName: message.jobName,
    });
  }
}
