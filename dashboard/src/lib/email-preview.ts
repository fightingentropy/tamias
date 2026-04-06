type ParsedContentType = {
  mimeType: string;
  params: Record<string, string>;
};

export type EmailPreviewData = {
  subject: string | null;
  from: string | null;
  to: string | null;
  date: string | null;
  body: string;
};

type ParsedMimeSection = {
  headers: Map<string, string>;
  body: string;
};

type ExtractedBody = {
  text: string | null;
  html: string | null;
};

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function splitHeaderAndBody(value: string) {
  const normalized = normalizeLineEndings(value);
  const separatorIndex = normalized.indexOf("\n\n");

  if (separatorIndex === -1) {
    return {
      headerText: normalized,
      bodyText: "",
    };
  }

  return {
    headerText: normalized.slice(0, separatorIndex),
    bodyText: normalized.slice(separatorIndex + 2),
  };
}

function parseHeaders(headerText: string) {
  const headers = new Map<string, string>();
  let currentHeader: string | null = null;

  for (const line of normalizeLineEndings(headerText).split("\n")) {
    if (!line.trim()) {
      continue;
    }

    if (/^\s/.test(line) && currentHeader) {
      headers.set(currentHeader, `${headers.get(currentHeader) ?? ""} ${line.trim()}`.trim());
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    currentHeader = line.slice(0, separatorIndex).trim().toLowerCase();
    headers.set(currentHeader, line.slice(separatorIndex + 1).trim());
  }

  return headers;
}

function parseMimeSection(raw: string): ParsedMimeSection {
  const { headerText, bodyText } = splitHeaderAndBody(raw);

  return {
    headers: parseHeaders(headerText),
    body: bodyText,
  };
}

function parseContentType(value: string | undefined): ParsedContentType {
  if (!value) {
    return {
      mimeType: "text/plain",
      params: {},
    };
  }

  const [mimeType = "text/plain", ...rawParams] = value.split(";");
  const params: Record<string, string> = {};

  for (const rawParam of rawParams) {
    const [key, ...rawValueParts] = rawParam.split("=");

    if (!key || rawValueParts.length === 0) {
      continue;
    }

    const paramValue = rawValueParts.join("=").trim();
    params[key.trim().toLowerCase()] = paramValue.replace(/^"|"$/g, "");
  }

  return {
    mimeType: mimeType.trim().toLowerCase(),
    params,
  };
}

function normalizeCharset(charset?: string) {
  const normalized = charset?.trim().toLowerCase();

  if (!normalized) {
    return "utf-8";
  }

  if (normalized === "utf8") {
    return "utf-8";
  }

  if (normalized === "iso-8859-1") {
    return "windows-1252";
  }

  return normalized;
}

function decodeBytes(bytes: Uint8Array, charset?: string) {
  try {
    return new TextDecoder(normalizeCharset(charset)).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function quotedPrintableToBytes(value: string) {
  const bytes: number[] = [];
  const normalized = value.replace(/=\n/g, "").replace(/=\r\n/g, "");

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];

    if (!current) {
      continue;
    }

    if (
      current === "=" &&
      index + 2 < normalized.length &&
      /^[0-9a-f]{2}$/i.test(normalized.slice(index + 1, index + 3))
    ) {
      bytes.push(Number.parseInt(normalized.slice(index + 1, index + 3), 16));
      index += 2;
      continue;
    }

    bytes.push(current.charCodeAt(0));
  }

  return new Uint8Array(bytes);
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function decodeTransferBody(
  value: string,
  transferEncoding: string | undefined,
  charset: string | undefined,
) {
  const normalizedEncoding = transferEncoding?.trim().toLowerCase();

  if (normalizedEncoding === "base64") {
    try {
      return decodeBytes(base64ToBytes(value), charset);
    } catch {
      return value.trim();
    }
  }

  if (normalizedEncoding === "quoted-printable") {
    try {
      return decodeBytes(quotedPrintableToBytes(value), charset);
    } catch {
      return value.trim();
    }
  }

  return value.trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCharCode(Number.parseInt(codePoint, 10)));
}

function htmlToText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeMimeWord(charset: string, encoding: string, value: string) {
  try {
    if (encoding.toUpperCase() === "B") {
      return decodeBytes(base64ToBytes(value), charset);
    }

    return decodeBytes(quotedPrintableToBytes(value.replaceAll("_", " ")), charset);
  } catch {
    return value;
  }
}

function decodeMimeWords(value: string | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace(
      /=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g,
      (_, charset: string, encoding: string, content: string) =>
        decodeMimeWord(charset, encoding, content),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function splitMultipartBody(body: string, boundary: string) {
  const normalized = normalizeLineEndings(body);
  const marker = `--${boundary}`;
  const parts = normalized.split(marker).slice(1);
  const sections: string[] = [];

  for (const part of parts) {
    if (part.startsWith("--")) {
      break;
    }

    const trimmed = part.replace(/^\n/, "").replace(/\n$/, "");

    if (trimmed.trim()) {
      sections.push(trimmed);
    }
  }

  return sections;
}

function extractBody(raw: string): ExtractedBody {
  const { headers, body } = parseMimeSection(raw);
  const { mimeType, params } = parseContentType(headers.get("content-type"));

  if (mimeType.startsWith("multipart/") && params.boundary) {
    let bestText: string | null = null;
    let bestHtml: string | null = null;

    for (const section of splitMultipartBody(body, params.boundary)) {
      const extracted = extractBody(section);

      bestText ??= extracted.text;
      bestHtml ??= extracted.html;

      if (bestText && bestHtml) {
        break;
      }
    }

    return {
      text: bestText,
      html: bestHtml,
    };
  }

  const decodedBody = decodeTransferBody(
    body,
    headers.get("content-transfer-encoding"),
    params.charset,
  );

  if (mimeType === "text/html") {
    return {
      text: null,
      html: decodedBody,
    };
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "message/rfc822" ||
    mimeType === "application/octet-stream"
  ) {
    return {
      text: decodedBody,
      html: null,
    };
  }

  return {
    text: null,
    html: null,
  };
}

export function parseEmailPreview(rawEmail: string): EmailPreviewData {
  const { headers, body } = parseMimeSection(rawEmail);
  const extracted = extractBody(rawEmail);
  const plainTextBody =
    extracted.text?.trim() || (extracted.html ? htmlToText(extracted.html) : "") || body.trim();

  return {
    subject: decodeMimeWords(headers.get("subject")),
    from: decodeMimeWords(headers.get("from")),
    to: decodeMimeWords(headers.get("to")),
    date: decodeMimeWords(headers.get("date")),
    body: plainTextBody || "No email body available.",
  };
}
