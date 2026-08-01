import { createHash } from "node:crypto";
import { uploadVaultFile } from "@tamias/storage";
import { zipSync } from "fflate";
import { type SubmissionArtifactBundleRecord } from "./types";

export function buildCsvChecksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function buildZipBundle(files: Array<{ name: string; data: Buffer }>) {
  return Buffer.from(
    zipSync(Object.fromEntries(files.map((file) => [file.name, new Uint8Array(file.data)])), {
      level: 9,
    }),
  );
}

export async function createSubmissionArtifactBundle(args: {
  teamId: string;
  scope: "corporation-tax";
  periodKey: string;
  files: Array<{ name: string; data: Buffer }>;
  manifest: Record<string, unknown>;
}) {
  const zipBuffer = await buildZipBundle([
    ...args.files,
    {
      name: "manifest.json",
      data: Buffer.from(JSON.stringify(args.manifest, null, 2), "utf8"),
    },
  ]);
  const generatedAt = new Date().toISOString();
  const timestampToken = generatedAt.replaceAll(/[:.]/g, "-");
  const fileName = `${args.scope}-${args.periodKey}-${timestampToken}.zip`;
  const filePath = `${args.teamId}/compliance/submissions/${args.scope}/${args.periodKey}/${fileName}`;
  const uploadResult = await uploadVaultFile({
    path: filePath,
    blob: zipBuffer,
    contentType: "application/zip",
    size: zipBuffer.length,
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  return {
    filePath,
    fileName,
    generatedAt,
    checksum: createHash("sha256").update(zipBuffer).digest("hex"),
  } satisfies SubmissionArtifactBundleRecord;
}
