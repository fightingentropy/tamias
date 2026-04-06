import { DurableObject } from "cloudflare:workers";
import {
  type CloudflareRecurringScheduleRequest,
  getNextRecurringScheduleAlarmAt,
  isCloudflareRecurringScheduleCancelRequest,
  isCloudflareRecurringScheduleRequest,
} from "./bridge-helpers";
import { getQueueBinding } from "./queue-bindings";
import type { CloudflareAsyncEnv } from "./shared";

type StoredRecurringSchedule = CloudflareRecurringScheduleRequest & {
  createdAt: string;
  updatedAt: string;
};

export class RunCoordinator extends DurableObject<CloudflareAsyncEnv> {
  private async getStoredSchedule() {
    return this.ctx.storage.get<StoredRecurringSchedule>("schedule");
  }

  private async scheduleNextAlarm(cron: string) {
    const nextAlarmAt = getNextRecurringScheduleAlarmAt(cron);

    if (!nextAlarmAt) {
      throw new Error(`Unsupported recurring schedule cron: ${cron}`);
    }

    await this.ctx.storage.setAlarm(nextAlarmAt);
    return nextAlarmAt;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/schedule") {
      const payload = await request.json().catch(() => null);
      if (!isCloudflareRecurringScheduleRequest(payload)) {
        return Response.json({ error: "Invalid recurring schedule payload" }, { status: 400 });
      }

      const timestamp = new Date().toISOString();
      const existing = await this.getStoredSchedule();
      const schedule: StoredRecurringSchedule = {
        ...payload,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      const nextAlarmAt = await this.scheduleNextAlarm(schedule.cron);
      await this.ctx.storage.put("schedule", schedule);

      return Response.json({
        status: "active",
        scheduleId: schedule.scheduleId,
        taskId: schedule.taskId,
        nextAlarmAt: new Date(nextAlarmAt).toISOString(),
      });
    }

    if (request.method === "POST" && url.pathname === "/schedule/cancel") {
      const payload = await request.json().catch(() => null);
      if (!isCloudflareRecurringScheduleCancelRequest(payload)) {
        return Response.json(
          { error: "Invalid recurring schedule cancel payload" },
          { status: 400 },
        );
      }

      await this.ctx.storage.deleteAlarm();
      await this.ctx.storage.deleteAll();

      return Response.json({
        canceled: true,
        scheduleId: payload.scheduleId,
      });
    }

    const schedule = await this.getStoredSchedule();
    const nextAlarmAt = await this.ctx.storage.getAlarm();

    return Response.json({
      status: schedule ? "active" : "idle",
      runtime: "cloudflare-durable-object",
      environment: this.env.TAMIAS_ENVIRONMENT ?? "development",
      schedule,
      nextAlarmAt: typeof nextAlarmAt === "number" ? new Date(nextAlarmAt).toISOString() : null,
    });
  }

  async alarm() {
    const { logger } = await import("./shared");
    const schedule = await this.getStoredSchedule();
    if (!schedule) {
      logger.warn("RunCoordinator alarm fired without stored schedule", {
        durableObjectId: this.ctx.id.toString(),
      });
      return;
    }

    const queueBinding = getQueueBinding(this.env, schedule.message.queue);
    if (!queueBinding) {
      logger.error("Missing queue binding for recurring schedule", {
        scheduleId: schedule.scheduleId,
        queue: schedule.message.queue,
        queueName: schedule.message.queueName,
        jobName: schedule.message.jobName,
      });
      return;
    }

    await queueBinding.send(schedule.message, {
      contentType: "json",
    });

    const nextAlarmAt = await this.scheduleNextAlarm(schedule.cron);

    logger.info("RunCoordinator alarm enqueued recurring job", {
      scheduleId: schedule.scheduleId,
      taskId: schedule.taskId,
      queue: schedule.message.queue,
      queueName: schedule.message.queueName,
      jobName: schedule.message.jobName,
      nextAlarmAt: new Date(nextAlarmAt).toISOString(),
    });
  }
}
