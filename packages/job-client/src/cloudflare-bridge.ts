import {
  getCloudflareAsyncServiceBinding,
  getCloudflareBridgeToken,
  getCloudflareBridgeUrl,
  getCloudflareQueueBinding,
  getCloudflareScheduleRuntime,
  toCloudflareDelaySeconds,
  type CloudflareBridgeRequest,
  type CloudflareRecurringScheduleRequest,
  type CloudflareWorkflowBridgeRequest,
  type CloudflareWorkflowInstanceRequest,
  type CloudflareWorkflowStatusResponse,
} from "./cloudflare-runtime";

function getConfiguredCloudflareBridge() {
  const bridgeUrl = getCloudflareBridgeUrl();
  const bridgeToken = getCloudflareBridgeToken();

  if (!bridgeUrl || !bridgeToken) {
    throw new Error("Cloudflare async transport is not configured");
  }

  return { bridgeUrl, bridgeToken };
}

async function throwCloudflareBridgeError(
  response: Response,
  label: string,
): Promise<never> {
  const errorText = await response.text().catch(() => "");
  throw new Error(
    `${label} (${response.status}): ${errorText || response.statusText}`,
  );
}

export async function enqueueViaCloudflareBridge(
  request: CloudflareBridgeRequest,
): Promise<void> {
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

  const { bridgeUrl, bridgeToken } = getConfiguredCloudflareBridge();
  const response = await fetch(
    new URL("/internal/enqueue", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    return;
  }

  return throwCloudflareBridgeError(
    response,
    "Cloudflare async bridge rejected enqueue",
  );
}

export async function startCloudflareWorkflowViaBridge(
  request: CloudflareWorkflowBridgeRequest,
): Promise<void> {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    await asyncWorker.startWorkflow(request);
    return;
  }

  const { bridgeUrl, bridgeToken } = getConfiguredCloudflareBridge();
  const response = await fetch(
    new URL("/internal/workflows/start", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    return;
  }

  return throwCloudflareBridgeError(
    response,
    "Cloudflare workflow bridge rejected start",
  );
}

export async function cancelCloudflareWorkflowViaBridge(
  request: CloudflareWorkflowInstanceRequest,
): Promise<boolean> {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    const response = await asyncWorker.cancelWorkflow(request);
    return response.canceled === true;
  }

  const { bridgeUrl, bridgeToken } = getConfiguredCloudflareBridge();
  const response = await fetch(
    new URL("/internal/workflows/cancel", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as {
      canceled?: boolean;
    } | null;
    return body?.canceled === true;
  }

  return throwCloudflareBridgeError(
    response,
    "Cloudflare workflow bridge rejected cancel",
  );
}

export async function upsertCloudflareRecurringScheduleViaBridge(
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

  const { bridgeUrl, bridgeToken } = getConfiguredCloudflareBridge();
  const response = await fetch(
    new URL("/internal/schedules/upsert", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify(request),
    },
  );

  if (response.ok) {
    return;
  }

  return throwCloudflareBridgeError(
    response,
    "Cloudflare schedule bridge rejected upsert",
  );
}

export async function cancelCloudflareScheduleViaBridge(
  scheduleId: string,
): Promise<boolean> {
  const scheduleRuntime = getCloudflareScheduleRuntime();
  if (scheduleRuntime) {
    return scheduleRuntime.cancelRecurringSchedule(scheduleId);
  }

  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    const response = await asyncWorker.cancelRecurringSchedule({ scheduleId });
    return response.canceled === true;
  }

  const { bridgeUrl, bridgeToken } = getConfiguredCloudflareBridge();
  const response = await fetch(
    new URL("/internal/schedules/cancel", bridgeUrl).toString(),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bridgeToken}`,
      },
      body: JSON.stringify({ scheduleId }),
    },
  );

  if (response.ok) {
    const body = (await response.json().catch(() => null)) as {
      canceled?: boolean;
    } | null;
    return body?.canceled === true;
  }

  return throwCloudflareBridgeError(
    response,
    "Cloudflare schedule bridge rejected cancel",
  );
}

export async function getCloudflareWorkflowStatusViaBridge(
  instanceId: string,
): Promise<CloudflareWorkflowStatusResponse> {
  const asyncWorker = getCloudflareAsyncServiceBinding();
  if (asyncWorker) {
    return asyncWorker.getWorkflowStatus({ instanceId });
  }

  const { bridgeUrl, bridgeToken } = getConfiguredCloudflareBridge();
  const url = new URL("/internal/workflows/status", bridgeUrl);
  url.searchParams.set("instanceId", instanceId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      authorization: `Bearer ${bridgeToken}`,
    },
  });

  if (response.ok) {
    return (await response.json()) as CloudflareWorkflowStatusResponse;
  }

  return throwCloudflareBridgeError(
    response,
    "Cloudflare workflow bridge rejected status",
  );
}
