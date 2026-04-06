import { createHash } from "node:crypto";
import type { ExportBundleRecord } from "@tamias/app-data-convex";
import { uploadVaultFile } from "@tamias/storage";
import type { YearEndExportArchive } from "./export-archive";

export async function persistYearEndExportBundle(args: {
  teamId: string;
  periodKey: string;
  archive: YearEndExportArchive;
}) {
  const fileName = `year-end-${args.periodKey}-${args.archive.generatedAt.slice(0, 10)}.zip`;
  const filePath = `${args.teamId}/compliance/year-end/${args.periodKey}/${fileName}`;
  const uploadResult = await uploadVaultFile({
    path: filePath,
    blob: args.archive.zipBuffer,
    contentType: "application/zip",
    size: args.archive.zipBuffer.length,
  });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  return {
    id: crypto.randomUUID(),
    filePath,
    fileName,
    checksum: createHash("sha256").update(args.archive.zipBuffer).digest("hex"),
    generatedAt: args.archive.generatedAt,
    manifest: args.archive.manifest,
  } satisfies ExportBundleRecord;
}
