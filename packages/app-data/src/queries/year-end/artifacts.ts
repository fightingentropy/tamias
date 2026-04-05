import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { uploadVaultFile } from "@tamias/storage";
import { type SubmissionArtifactBundleRecord } from "./types";

export function buildCsvChecksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function buildZipBundle(
  files: Array<{ name: string; data: Buffer }>,
) {
  const { default: archiver } = await import("archiver");

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = new PassThrough();

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", reject);
    archive.pipe(stream);

    for (const file of files) {
      archive.append(file.data, { name: file.name });
    }

    archive.finalize();
  });
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
