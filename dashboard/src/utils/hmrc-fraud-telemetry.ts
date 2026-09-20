import { HmrcBrowserTelemetrySchema } from "@tamias/compliance/fraud-prevention-types";

const DEVICE_KEY = "tamias.hmrc.device-id";
// Called only for user-initiated HMRC features. Values are collected at request
// time rather than stored in query keys or guessed on the server.
export function collectHmrcBrowserTelemetry(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let deviceId = localStorage.getItem(DEVICE_KEY);
    if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, deviceId);
    }
    const offset = -new Date().getTimezoneOffset();
    const timezone = `UTC${offset >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
    const result = HmrcBrowserTelemetrySchema.safeParse({
      deviceId,
      userAgent: navigator.userAgent,
      timezone,
      screens: [
        {
          width: screen.width,
          height: screen.height,
          scalingFactor: devicePixelRatio,
          colourDepth: screen.colorDepth,
        },
      ],
      window: { width: window.innerWidth, height: window.innerHeight },
    });
    return result.success ? encodeURIComponent(JSON.stringify(result.data)) : undefined;
  } catch {
    // Storage can be disabled by the browser. Do not replace a persistent ID
    // with a different server-generated ID on each request.
    return undefined;
  }
}
