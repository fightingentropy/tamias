import { createLoggerWithContext } from "@tamias/logger";

const logger = createLoggerWithContext("worker:cloudflare:images-client");

let imagesBinding: ImagesBinding | null = null;

function getImagesBinding() {
  if (!imagesBinding) {
    throw new Error("Cloudflare Images binding is not configured");
  }

  return imagesBinding;
}

function toReadableStream(input: ArrayBuffer) {
  const stream = new Response(input).body;

  if (!stream) {
    throw new Error("Failed to create image stream");
  }

  return stream;
}

function getResizeOutputFormat(mimetype: string): ImageOutputOptions["format"] {
  switch (mimetype.toLowerCase()) {
    case "image/png":
      return "image/png";
    case "image/webp":
      return "image/webp";
    case "image/gif":
      return "image/gif";
    case "image/jpeg":
    case "image/jpg":
    case "image/tiff":
      return "image/jpeg";
    default:
      return "image/jpeg";
  }
}

function shouldApplyLossyQuality(format: ImageOutputOptions["format"]) {
  return format === "image/jpeg" || format === "image/webp";
}

async function transformToBuffer(
  input: ArrayBuffer,
  transform: ImageTransform,
  output: ImageOutputOptions,
) {
  const result = await getImagesBinding()
    .input(toReadableStream(input))
    .transform(transform)
    .output(output);

  const image = await new Response(result.image()).arrayBuffer();

  return {
    buffer: Buffer.from(image),
    mimetype: result.contentType(),
  };
}

export function configureCloudflareImagesBinding(binding?: ImagesBinding) {
  imagesBinding = binding ?? null;
}

export async function resizeImageViaCloudflareImages(input: {
  buffer: ArrayBuffer;
  mimetype: string;
  maxSize: number;
}) {
  const info = await getImagesBinding().info(toReadableStream(input.buffer));

  if (
    "width" in info &&
    "height" in info &&
    info.width <= input.maxSize &&
    info.height <= input.maxSize
  ) {
    logger.info("Image already within size limits, skipping resize", {
      width: info.width,
      height: info.height,
      maxSize: input.maxSize,
      mimetype: input.mimetype,
    });

    return {
      buffer: Buffer.from(input.buffer),
      mimetype: input.mimetype,
    };
  }

  const format = getResizeOutputFormat(input.mimetype);

  const output = shouldApplyLossyQuality(format)
    ? {
        format,
        quality: 85,
        anim: false,
      }
    : {
        format,
        anim: false,
      };

  const result = await transformToBuffer(
    input.buffer,
    {
      width: input.maxSize,
      height: input.maxSize,
      fit: "scale-down",
    },
    output,
  );

  logger.info("Resized image via Cloudflare Images", {
    mimetype: input.mimetype,
    outputMimetype: result.mimetype,
    maxSize: input.maxSize,
  });

  return result;
}

export async function convertHeicToJpegViaCloudflareImages(input: {
  buffer: ArrayBuffer;
  maxSize: number;
}) {
  const result = await transformToBuffer(
    input.buffer,
    {
      width: input.maxSize,
      height: input.maxSize,
      fit: "scale-down",
    },
    {
      format: "image/jpeg",
      quality: 85,
      anim: false,
    },
  );

  logger.info("Converted HEIC via Cloudflare Images", {
    maxSize: input.maxSize,
  });

  return {
    buffer: result.buffer,
    mimetype: "image/jpeg" as const,
  };
}
