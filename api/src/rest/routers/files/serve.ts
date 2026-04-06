import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { proxyFileSchema } from "../../../schemas/files";
import { downloadVaultFile } from "../../../services/storage";
import { withDatabase } from "../../middleware/db";
import { withFileAuth } from "../../middleware/file-auth";
import { withClientIp } from "../../middleware/ip";
import type { Context } from "../../types";
import { getContentTypeFromFilename, normalizeAndValidatePath } from "./utils";

const app = new OpenAPIHono<Context>();

const errorResponseSchema = z.object({
  error: z.string(),
});

app.openapi(
  createRoute({
    method: "get",
    path: "/proxy",
    summary: "Proxy file from storage",
    operationId: "proxyFile",
    "x-speakeasy-name-override": "proxy",
    description:
      "Proxies a file from storage. Requires team file key (fk) query parameter for access.",
    tags: ["Files"],
    request: {
      query: proxyFileSchema,
    },
    responses: {
      200: {
        description: "File content",
        content: {
          "application/octet-stream": {
            schema: {
              type: "string",
              format: "binary",
            },
          },
        },
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
      404: {
        description: "Not found",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
    middleware: [withClientIp, withDatabase, withFileAuth],
  }),
  async (c) => {
    const { filePath } = c.req.valid("query");
    const { normalizedPath, pathArray } = normalizeAndValidatePath(
      filePath,
      c.get("teamId"),
    );

    const { data, error } = await downloadVaultFile(normalizedPath);

    if (error || !data) {
      return c.json(
        {
          error: error?.message || "File not found",
        },
        404,
      );
    }

    // Get the blob and determine content type
    const blob = await data.arrayBuffer();
    const filename = pathArray.at(-1);
    const contentType =
      data.type ||
      (filename
        ? getContentTypeFromFilename(filename)
        : "application/octet-stream");

    // Set cache headers for images (long cache for immutable content)
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cross-Origin-Resource-Policy": "cross-origin",
    };

    if (
      contentType === "application/pdf" ||
      contentType.startsWith("image/") ||
      contentType === "message/rfc822"
    ) {
      headers["Content-Disposition"] = filename
        ? `inline; filename="${filename}"`
        : "inline";
    }

    // Add cache headers for images
    if (contentType.startsWith("image/")) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }

    return new Response(blob, {
      headers,
    });
  },
);

export { app as serveRouter };
