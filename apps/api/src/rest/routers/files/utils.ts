import { HTTPException } from "hono/http-exception";

const TEAM_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalize and validate file path
 * Accepts both team-prefixed paths and team-relative vault paths.
 */
export function normalizeAndValidatePath(
  filePath: string,
  fallbackTeamId?: string,
): {
  normalizedPath: string;
  pathTeamId: string;
  pathArray: string[];
} {
  // Normalize path
  const normalizedPath = filePath.startsWith("vault/")
    ? filePath.substring("vault/".length)
    : filePath;

  const pathParts = normalizedPath.split("/").filter(Boolean);
  const pathTeamId = pathParts[0];

  if (pathTeamId && TEAM_ID_REGEX.test(pathTeamId)) {
    return {
      normalizedPath: pathParts.join("/"),
      pathTeamId,
      pathArray: pathParts,
    };
  }

  if (!fallbackTeamId || !TEAM_ID_REGEX.test(fallbackTeamId)) {
    throw new HTTPException(400, {
      message:
        "Invalid file path format. Path must be team-relative or start with a valid teamId UUID.",
    });
  }

  const resolvedPath = [fallbackTeamId, ...pathParts];

  return {
    normalizedPath: resolvedPath.join("/"),
    pathTeamId: fallbackTeamId,
    pathArray: resolvedPath,
  };
}

/**
 * Get content type from filename extension
 */
export function getContentTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return contentTypes[ext || ""] || "application/octet-stream";
}
