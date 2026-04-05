import { createHash } from "node:crypto";

export function buildSnapshotChecksum(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
