"use client";

export interface CanvasExportOptions {
  filename?: string;
  title: string;
}

function getCanvasContent(): HTMLElement | null {
  const element = document.querySelector("[data-canvas-content]") as HTMLElement;

  if (element && element.offsetHeight > 0 && element.offsetWidth > 0) {
    return element;
  }

  console.warn("Canvas content not found");
  return null;
}

function getHeadMarkup() {
  return Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("\n");
}

function getPrintDocumentMarkup({ content, title }: { content: string; title: string }) {
  const htmlClassName = document.documentElement.className;
  const bodyClassName = document.body.className;

  return `<!DOCTYPE html>
<html class="${htmlClassName}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${getHeadMarkup()}
    <style>
      html, body {
        margin: 0;
        padding: 0;
      }

      body {
        background: var(--background, #fff);
      }

      [data-hide-in-pdf="true"] {
        display: none !important;
      }

      .tamias-print-root {
        display: flex;
        justify-content: center;
        padding: 24px;
      }

      .tamias-print-root > * {
        width: min(1120px, 100%);
      }

      @page {
        margin: 12mm;
        size: auto;
      }

      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .tamias-print-root {
          padding: 0;
        }
      }
    </style>
  </head>
  <body class="${bodyClassName}">
    <div class="tamias-print-root">${content}</div>
  </body>
</html>`;
}

export async function printCanvasReport({
  filename = "canvas-report.pdf",
  title,
}: CanvasExportOptions): Promise<void> {
  const content = getCanvasContent();

  if (!content) {
    throw new Error("Canvas content not found");
  }

  const printWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!printWindow) {
    throw new Error("Unable to open print window");
  }

  printWindow.document.open();
  printWindow.document.write(
    getPrintDocumentMarkup({
      content: content.outerHTML,
      title: filename || title,
    }),
  );
  printWindow.document.close();

  await new Promise<void>((resolve) => {
    const handleReady = () => {
      printWindow.focus();
      printWindow.print();
      resolve();
    };

    if (printWindow.document.readyState === "complete") {
      handleReady();
      return;
    }

    printWindow.addEventListener("load", handleReady, { once: true });
  });
}

export async function shareCanvasReport({ title }: CanvasExportOptions): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  await navigator.share({
    title,
    url: window.location.href,
  });

  return true;
}
