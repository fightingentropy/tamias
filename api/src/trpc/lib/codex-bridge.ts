import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  PDF_STATEMENT_EXTRACTION_PROMPT,
  extractedPdfStatementSchema,
  type ExtractedPdfStatement,
} from "@tamias/import";

const CODEX_TIMEOUT_MS = 180_000;

let cachedAvailability: boolean | null = null;

export async function isCodexBridgeAvailable(): Promise<boolean> {
  if (cachedAvailability !== null) return cachedAvailability;

  // Only available when running under Bun with shell + filesystem access
  // (i.e. local dev), never in a Cloudflare Worker.
  if (typeof (globalThis as { Bun?: unknown }).Bun === "undefined") {
    cachedAvailability = false;
    return false;
  }

  try {
    const authFile = await readFile(join(homedir(), ".codex", "auth.json"), "utf-8").catch(
      () => null,
    );
    if (!authFile) {
      cachedAvailability = false;
      return false;
    }

    const proc = Bun.spawn(["codex", "--version"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    const code = await proc.exited;
    cachedAvailability = code === 0;
  } catch {
    cachedAvailability = false;
  }

  return cachedAvailability;
}

async function extractTextFromPdfBytes(pdfBytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(doc, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ? fenced[1].trim() : trimmed;
}

export async function extractStatementWithCodex({
  pdfBytes,
}: {
  pdfBytes: Uint8Array;
}): Promise<ExtractedPdfStatement> {
  const text = await extractTextFromPdfBytes(pdfBytes);

  if (!text.trim()) {
    throw new Error(
      "No text could be extracted from this PDF. The statement may be a scanned image — set OPENAI_API_KEY for vision-based extraction.",
    );
  }

  const prompt = [
    PDF_STATEMENT_EXTRACTION_PROMPT,
    "",
    "The bank statement text is provided below verbatim. Return only JSON matching the schema — no commentary, no code fences.",
    "",
    "<statement_text>",
    text,
    "</statement_text>",
  ].join("\n");

  const tempDir = await mkdtemp(join(tmpdir(), "codex-statement-"));
  const outputPath = join(tempDir, "output.txt");

  try {
    const proc = Bun.spawn(
      [
        "codex",
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--ignore-user-config",
        "--sandbox",
        "read-only",
        "--output-last-message",
        outputPath,
        "-",
      ],
      {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    if (!proc.stdin) {
      throw new Error("codex exec stdin not available");
    }
    proc.stdin.write(prompt);
    proc.stdin.end();

    const exitPromise = proc.exited;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`codex exec timed out after ${CODEX_TIMEOUT_MS}ms`));
      }, CODEX_TIMEOUT_MS);
    });

    const code = await Promise.race([exitPromise, timeoutPromise]);

    if (code !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`codex exec exited with code ${code}: ${stderr.slice(0, 500)}`);
    }

    const raw = await readFile(outputPath, "utf-8");
    const cleaned = stripCodeFence(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`codex exec returned non-JSON output: ${cleaned.slice(0, 200)}`);
    }

    return extractedPdfStatementSchema.parse(parsed);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
