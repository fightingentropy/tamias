"use client";

export interface CanvasPdfOptions {
  filename?: string;
  quality?: number;
  scale?: number;
  padding?: number;
  theme?: string;
}

type ResolvedCanvasTheme = {
  backgroundColor: string;
  backgroundRgb: { r: number; g: number; b: number };
};

let html2canvasPromise: Promise<typeof import("html2canvas").default> | null =
  null;
let jsPdfPromise: Promise<typeof import("jspdf").jsPDF> | null = null;

async function getHtml2Canvas() {
  html2canvasPromise ??= import("html2canvas").then((mod) => mod.default);
  return html2canvasPromise;
}

async function getJsPdf() {
  jsPdfPromise ??= import("jspdf").then((mod) => mod.jsPDF);
  return jsPdfPromise;
}

function resolveCanvasTheme(theme?: string): ResolvedCanvasTheme {
  const resolvedTheme =
    theme === "system" || !theme
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  if (resolvedTheme === "dark") {
    return {
      backgroundColor: "#0c0c0c",
      backgroundRgb: { r: 12, g: 12, b: 12 },
    };
  }

  return {
    backgroundColor: "#ffffff",
    backgroundRgb: { r: 255, g: 255, b: 255 },
  };
}

function cloneCanvasForPdf(clonedDoc: Document, backgroundColor: string) {
  const mainContainer = clonedDoc.querySelector("[data-canvas-content]");
  if (mainContainer) {
    const containerEl = mainContainer as HTMLElement;
    containerEl.style.backgroundColor = backgroundColor;
    containerEl.style.overflow = "visible";
    containerEl.style.height = "auto";
    containerEl.style.maxHeight = "none";
  }

  if (clonedDoc.body) {
    clonedDoc.body.style.backgroundColor = backgroundColor;
    clonedDoc.body.style.overflow = "visible";
    clonedDoc.body.style.height = "auto";
  }

  if (clonedDoc.documentElement) {
    clonedDoc.documentElement.style.backgroundColor = backgroundColor;
    clonedDoc.documentElement.style.overflow = "visible";
    clonedDoc.documentElement.style.height = "auto";
  }

  const allTextElements = clonedDoc.querySelectorAll("svg text, svg tspan");
  for (const element of allTextElements) {
    (element as HTMLElement).style.fontFamily =
      "Hedvig Letters Sans, system-ui, sans-serif";
    (element as HTMLElement).style.fontSize = "10px";
  }

  const hideElements = clonedDoc.querySelectorAll('[data-hide-in-pdf="true"]');
  for (const element of hideElements) {
    (element as HTMLElement).style.display = "none";
  }

  const allElements = clonedDoc.querySelectorAll("*");
  for (const element of allElements) {
    const htmlElement = element as HTMLElement;
    htmlElement.style.animation = "none";
    htmlElement.style.transition = "none";
    htmlElement.style.opacity = "1";
  }
}

async function captureCanvasContent({
  scale,
  backgroundColor,
}: {
  scale: number;
  backgroundColor: string;
}) {
  const html2canvas = await getHtml2Canvas();

  const canvasContent = getCanvasContent();
  if (!canvasContent) {
    throw new Error("Canvas content not found");
  }

  const elementHeight = canvasContent.scrollHeight || canvasContent.offsetHeight;
  const extraHeight = 100;

  return html2canvas(canvasContent, {
    scale,
    backgroundColor,
    useCORS: true,
    allowTaint: true,
    logging: false,
    removeContainer: true,
    imageTimeout: 0,
    height: elementHeight + extraHeight,
    scrollX: 0,
    scrollY: 0,
    foreignObjectRendering: false,
    onclone: (clonedDoc) => {
      cloneCanvasForPdf(clonedDoc, backgroundColor);
    },
  });
}

async function buildPdf(
  canvas: HTMLCanvasElement,
  options: {
    quality: number;
    padding: number;
    backgroundRgb: { r: number; g: number; b: number };
  },
) {
  const jsPDF = await getJsPdf();

  const imgData = canvas.toDataURL("image/jpeg", options.quality);
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const a4Width = 210;
  const a4Height = 297;

  const scale = (a4Width - options.padding * 2) / imgWidth;
  const scaledWidth = imgWidth * scale;
  const scaledHeight = imgHeight * scale;
  const pdfHeight = Math.max(scaledHeight + options.padding * 2, a4Height);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [a4Width, pdfHeight],
  });

  pdf.setFillColor(
    options.backgroundRgb.r,
    options.backgroundRgb.g,
    options.backgroundRgb.b,
  );
  pdf.rect(0, 0, a4Width, pdfHeight, "F");

  pdf.addImage(
    imgData,
    "JPEG",
    options.padding,
    options.padding,
    scaledWidth,
    scaledHeight,
  );

  pdf.setProperties({
    title: "Canvas Report",
    subject: "Generated from Tamias Dashboard",
    author: "Tamias",
    creator: "Tamias Dashboard",
  });

  return pdf;
}

/**
 * Simple PDF generation from canvas content
 */
export async function generateCanvasPdf(
  options: CanvasPdfOptions = {},
): Promise<void> {
  const {
    filename = "canvas-report.pdf",
    quality = 1.0,
    scale = 4,
    padding = 10,
    theme,
  } = options;
  const { backgroundColor, backgroundRgb } = resolveCanvasTheme(theme);

  try {
    const canvas = await captureCanvasContent({
      scale,
      backgroundColor,
    });

    const pdf = await buildPdf(canvas, {
      quality,
      padding,
      backgroundRgb,
    });
    pdf.save(filename);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF from canvas");
  }
}

/**
 * Generate PDF as Blob for sharing
 */
export async function generateCanvasPdfBlob(
  options: CanvasPdfOptions = {},
): Promise<Blob> {
  const { quality = 1.0, scale = 4, padding = 10, theme } = options;
  const { backgroundColor, backgroundRgb } = resolveCanvasTheme(theme);

  try {
    const canvas = await captureCanvasContent({
      scale,
      backgroundColor,
    });
    const pdf = await buildPdf(canvas, {
      quality,
      padding,
      backgroundRgb,
    });
    return pdf.output("blob");
  } catch (error) {
    console.error("Error generating PDF blob:", error);
    throw new Error("Failed to generate PDF from canvas");
  }
}

/**
 * Get the canvas content element
 */
function getCanvasContent(): HTMLElement | null {
  const selectors = ["[data-canvas-content]"];

  for (const selector of selectors) {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && element.offsetHeight > 0 && element.offsetWidth > 0) {
      return element;
    }
  }

  console.warn("Canvas content not found");
  return null;
}
