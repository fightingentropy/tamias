import type { createLoggerWithContext } from "@tamias/logger";
import {
  convertHeicToJpegViaCloudflareImages,
  resizeImageViaCloudflareImages,
} from "../cloudflare/images-client";
import { IMAGE_SIZES } from "./timeout";

/**
 * Maximum file size for HEIC conversion (in bytes)
 * Files larger than this will skip AI classification to limit image work.
 */
export const MAX_HEIC_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export interface HeicConversionResult {
  buffer: Buffer;
  mimetype: "image/jpeg";
}

export interface ImageProcessingOptions {
  maxSize?: number;
}

export interface ResizeResult {
  buffer: Buffer;
  mimetype: string;
}

/**
 * Supported image mimetypes for resizing
 */
const RESIZABLE_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
]);

/**
 * Resize an image to fit within maxSize dimensions.
 *
 * - Preserves aspect ratio (resizes longest side to maxSize)
 * - Skips resize if image is already small enough
 * - Returns original buffer for unsupported mimetypes
 *
 * @param inputBuffer - Raw image buffer (ArrayBuffer from file download)
 * @param mimetype - Image mimetype (e.g., "image/jpeg")
 * @param logger - Logger instance for status messages
 * @param options - Optional configuration (maxSize defaults to IMAGE_SIZES.MAX_DIMENSION)
 * @returns Resized buffer and mimetype
 */
export async function resizeImage(
  inputBuffer: ArrayBuffer,
  mimetype: string,
  logger: ReturnType<typeof createLoggerWithContext>,
  options?: ImageProcessingOptions,
): Promise<ResizeResult> {
  const maxSize = options?.maxSize ?? IMAGE_SIZES.MAX_DIMENSION;

  // Validate input buffer
  if (!inputBuffer || inputBuffer.byteLength === 0) {
    throw new Error("Input buffer is empty");
  }

  // Skip non-image or unsupported formats
  if (!RESIZABLE_MIMETYPES.has(mimetype.toLowerCase())) {
    logger.info("Skipping resize for unsupported mimetype", { mimetype });
    return { buffer: Buffer.from(inputBuffer), mimetype };
  }

  try {
    return await resizeImageViaCloudflareImages({
      buffer: inputBuffer,
      mimetype,
      maxSize,
    });
  } catch (error) {
    logger.warn("Failed to resize image, returning original", {
      error: error instanceof Error ? error.message : "Unknown error",
      mimetype,
    });
    // Return original on error - graceful degradation
    return { buffer: Buffer.from(inputBuffer), mimetype };
  }
}

/**
 * Convert HEIC/HEIF image to JPEG.
 *
 * @param inputBuffer - Raw image buffer (ArrayBuffer from file download)
 * @param logger - Logger instance for status messages
 * @param options - Optional configuration (maxSize defaults to IMAGE_SIZES.MAX_DIMENSION)
 * @returns Converted JPEG buffer and mimetype
 * @throws Error if Cloudflare Images cannot transform the input
 */
export async function convertHeicToJpeg(
  inputBuffer: ArrayBuffer,
  logger: ReturnType<typeof createLoggerWithContext>,
  options?: ImageProcessingOptions,
): Promise<HeicConversionResult> {
  const maxSize = options?.maxSize ?? IMAGE_SIZES.MAX_DIMENSION;

  // Validate input buffer
  if (!inputBuffer || inputBuffer.byteLength === 0) {
    throw new Error("Input buffer is empty");
  }

  return convertHeicToJpegViaCloudflareImages({
    buffer: inputBuffer,
    maxSize,
  }).catch((error) => {
    logger.warn("Cloudflare Images failed to convert HEIC", {
      error: error instanceof Error ? error.message : "Unknown error",
      maxSize,
    });
    throw error;
  });
}
