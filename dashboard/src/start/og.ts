import { Buffer } from "node:buffer";

const HEDVIG_SANS_FONT_URL =
  "https://cdn.tamias.xyz/fonts/HedvigSans/HedvigLettersSans-Regular.ttf";
const HEDVIG_SERIF_FONT_URL =
  "https://cdn.tamias.xyz/fonts/HedvigSerif/HedvigLettersSerif-Regular.ttf?c=1";

async function fetchFont(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${url}`);
  }

  return response.arrayBuffer();
}

export function loadHedvigSansFont() {
  return fetchFont(HEDVIG_SANS_FONT_URL);
}

export function loadHedvigSerifFont() {
  return fetchFont(HEDVIG_SERIF_FONT_URL);
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function fetchDataUri(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await response.arrayBuffer());

    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}

function toFontFaceCss(fontFamily: string, fontData: ArrayBuffer) {
  return `@font-face { font-family: "${fontFamily}"; src: url(data:font/ttf;base64,${Buffer.from(
    fontData,
  ).toString(
    "base64",
  )}) format("truetype"); font-style: normal; font-weight: 400; font-display: swap; }`;
}

export async function loadHedvigSansFontCss() {
  return toFontFaceCss("hedvig-sans", await loadHedvigSansFont());
}

export async function loadHedvigSerifFontCss() {
  return toFontFaceCss("hedvig-serif", await loadHedvigSerifFont());
}

export function editorDocToLines(
  doc?: {
    content?: Array<{
      type: string;
      content?: Array<{ type: string; text?: string }>;
    }>;
  } | null,
) {
  if (!doc?.content?.length) {
    return [];
  }

  const lines: string[] = [];

  for (const node of doc.content) {
    if (node.type !== "paragraph") {
      continue;
    }

    let currentLine = "";

    for (const inlineContent of node.content ?? []) {
      if (inlineContent.type === "text") {
        currentLine += inlineContent.text ?? "";
        continue;
      }

      if (inlineContent.type === "hardBreak") {
        lines.push(currentLine);
        currentLine = "";
      }
    }

    lines.push(currentLine);
  }

  return lines.filter((line) => line.length > 0);
}

export async function renderPngResponse(svg: string, cacheControl?: string) {
  const { default: sharp } = await import("sharp");
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      ...(cacheControl ? { "cache-control": cacheControl } : {}),
    },
  });
}

export function buildOgSvgDocument({
  body,
  width = 1200,
  height = 630,
  fontCss = "",
  background = "#0C0C0C",
}: {
  body: string;
  width?: number;
  height?: number;
  fontCss?: string;
  background?: string;
}) {
  return `\
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <style>${fontCss}</style>
  <rect width="100%" height="100%" fill="${background}" />
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">
      ${body}
    </div>
  </foreignObject>
</svg>`;
}
