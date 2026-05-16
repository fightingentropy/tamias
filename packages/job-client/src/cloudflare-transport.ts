import {
  getCloudflareAsyncServiceBinding,
  getCloudflareQueueBinding,
  getCloudflareScheduleRuntime,
  toCloudflareDelaySeconds,
  type CloudflareRecurringScheduleRequest,
  type CloudflareWorkflowInstanceRequest,
  type CloudflareQueueRequest,
  type CloudflareWorkflowRequest,
  type CloudflareWorkflowStatusResponse,
} from "./cloudflare-runtime";

export async function enqueueViaCloudflareTransport(request: CloudflareQueueRequest): Promise<void> {
  const queueBinding = getCloudflareQueueBinding(request.queue);

  if (queueBinding) {
    await queueBinding.send(
      {
        queue: request.queue,
        queueName: request.queueName,
        runId: request.runId,
        jobName: request.jobName,
        payload: request.payload,
        maxAttempts: request.maxAttempts,
      },
      {
        contentType: "json",
        delaySeconds: toCloudflareDelaySeconds(request.delayMs),
      },
    );
    return;
  }

  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    await asyncWorker.enqueue(request);
    return;
  }

  throw new Error("Cloudflare async transport is not configured");
}

export async function startCloudflareWorkflowViaTransport(
  request: CloudflareWorkflowRequest,
): Promise<void> {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    await asyncWorker.startWorkflow(request);
    return;
  }

  throw new Error("Cloudflare workflow runtime is not configured");
}

export async function cancelCloudflareWorkflowViaTransport(
  request: CloudflareWorkflowInstanceRequest,
): Promise<boolean> {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    const response = await asyncWorker.cancelWorkflow(request);
    return response.canceled === true;
  }

  throw new Error("Cloudflare workflow runtime is not configured");
}

export async function upsertCloudflareRecurringScheduleViaTransport(
  request: CloudflareRecurringScheduleRequest,
): Promise<void> {
  const scheduleRuntime = getCloudflareScheduleRuntime();
  if (scheduleRuntime) {
    await scheduleRuntime.upsertRecurringSchedule(request);
    return;
  }

  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    await asyncWorker.upsertRecurringSchedule(request);
    return;
  }

  throw new Error("Cloudflare schedule runtime is not configured");
}

export async function cancelCloudflareScheduleViaTransport(scheduleId: string): Promise<boolean> {
  const scheduleRuntime = getCloudflareScheduleRuntime();
  if (scheduleRuntime) {
    return scheduleRuntime.cancelRecurringSchedule(scheduleId);
  }

  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    const response = await asyncWorker.cancelRecurringSchedule({ scheduleId });
    return response.canceled === true;
  }

  throw new Error("Cloudflare schedule runtime is not configured");
}

export async function getCloudflareWorkflowStatusViaTransport(
  instanceId: string,
): Promise<CloudflareWorkflowStatusResponse> {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    return asyncWorker.getWorkflowStatus({ instanceId });
  }

  throw new Error("Cloudflare workflow runtime is not configured");
}
