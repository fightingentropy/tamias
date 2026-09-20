import { z } from "zod";

const dimension = z.number().int().positive().max(100000);
export const HmrcBrowserTelemetrySchema = z
  .object({
    deviceId: z.string().uuid(),
    userAgent: z
      .string()
      .min(1)
      .max(2048)
      .regex(/^[\x20-\x7e]+$/),
    timezone: z.string().regex(/^UTC[+-](?:0[0-9]|1[0-4]):[0-5][0-9]$/),
    screens: z
      .array(
        z.object({
          width: dimension,
          height: dimension,
          scalingFactor: z.number().positive().max(20),
          colourDepth: z.number().int().positive().max(64),
        }),
      )
      .min(1)
      .max(16),
    window: z.object({ width: dimension, height: dimension }),
  })
  .strict();
export type HmrcBrowserTelemetry = z.infer<typeof HmrcBrowserTelemetrySchema>;
