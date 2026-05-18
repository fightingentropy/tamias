import React from "react";

type ReadableHtmlStream = ReadableStream<Uint8Array> & {
  allReady?: Promise<void>;
};

type ReactDomServerModule = {
  default?: ReactDomServerModule;
  renderToReadableStream?: (
    element: React.ReactNode,
    options?: {
      onError?: (error: unknown) => void;
      progressiveChunkSize?: number;
    },
  ) => Promise<ReadableHtmlStream>;
  renderToString?: (element: React.ReactNode) => string;
};

const doctype =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

const staticUtilityStyles: Record<string, string> = {
  "align-middle": "vertical-align: middle",
  "align-top": "vertical-align: top",
  block: "display: block",
  border: "border-width: 1px",
  "border-0": "border-width: 0",
  "border-b-[1px]": "border-bottom-width: 1px",
  "border-collapse": "border-collapse: collapse",
  "border-gray-300": "border-color: #d1d5db",
  "border-solid": "border-style: solid",
  "border-t": "border-top-width: 1px",
  "border-t-[1px]": "border-top-width: 1px",
  "bg-transparent": "background-color: transparent",
  "box-border": "box-sizing: border-box",
  "break-all": "word-break: break-all",
  "font-medium": "font-weight: 500",
  "font-normal": "font-weight: 400",
  "font-sans": 'font-family: "Hedvig Letters Sans", system-ui, Arial, sans-serif',
  "font-semibold": "font-weight: 600",
  "font-serif": 'font-family: "Hedvig Letters Serif", Georgia, serif',
  "h-[45px]": "height: 45px",
  "inline-block": "display: inline-block",
  "leading-[24px]": "line-height: 24px",
  "leading-relaxed": "line-height: 1.625",
  "line-clamp-1":
    "overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical",
  "m-0": "margin: 0",
  "max-w-[600px]": "max-width: 600px",
  "mb-2": "margin-bottom: 8px",
  "mb-4": "margin-bottom: 16px",
  "mb-[32px]": "margin-bottom: 32px",
  "mb-[40px]": "margin-bottom: 40px",
  "mb-[42px]": "margin-bottom: 42px",
  "mb-[50px]": "margin-bottom: 50px",
  "mb-[56px]": "margin-bottom: 56px",
  "mt-1": "margin-top: 4px",
  "mt-2": "margin-top: 8px",
  "mt-[32px]": "margin-top: 32px",
  "mt-[40px]": "margin-top: 40px",
  "mt-[50px]": "margin-top: 50px",
  "mt-[56px]": "margin-top: 56px",
  "mt-[8px]": "margin-top: 8px",
  "mx-0": "margin-left: 0; margin-right: 0",
  "mx-auto": "margin-left: auto; margin-right: auto",
  "my-0": "margin-top: 0; margin-bottom: 0",
  "my-[30px]": "margin-top: 30px; margin-bottom: 30px",
  "my-[40px]": "margin-top: 40px; margin-bottom: 40px",
  "my-auto": "margin-top: auto; margin-bottom: auto",
  "no-underline": "text-decoration: none",
  "p-0": "padding: 0",
  "p-[20px]": "padding: 20px",
  "pb-1": "padding-bottom: 4px",
  "pb-10": "padding-bottom: 40px",
  "pt-0": "padding-top: 0",
  "px-6": "padding-left: 24px; padding-right: 24px",
  "py-3": "padding-top: 12px; padding-bottom: 12px",
  "text-[#00C969]": "color: #00C969",
  "text-[12px]": "font-size: 12px",
  "text-[13px]": "font-size: 13px",
  "text-[14px]": "font-size: 14px",
  "text-[21px]": "font-size: 21px",
  "text-[24px]": "font-size: 24px",
  "text-[32px]": "font-size: 32px",
  "text-center": "text-align: center",
  "text-gray-600": "color: #4b5563",
  "text-left": "text-align: left",
  "text-xs": "font-size: 12px",
  underline: "text-decoration: underline",
  "w-[40px]": "width: 40px",
  "w-[245px]": "width: 245px",
  "w-[265px]": "width: 265px",
  "w-[280px]": "width: 280px",
  "w-full": "width: 100%",
};

function getUtilityStyle(className: string) {
  if (className.startsWith("md:")) {
    return null;
  }

  return staticUtilityStyles[className] ?? null;
}

function inlineEmailUtilityStyles(html: string) {
  return html.replace(/<([a-zA-Z][^>\s/]*)([^>]*)>/g, (tag) => {
    const classMatch = tag.match(/\sclass="([^"]*)"/);
    if (!classMatch) {
      return tag;
    }

    const classValue = classMatch[1] ?? "";
    const utilityStyles = classValue
      .split(/\s+/)
      .map(getUtilityStyle)
      .filter((style): style is string => Boolean(style))
      .join("; ");

    if (!utilityStyles) {
      return tag;
    }

    const styleMatch = tag.match(/\sstyle="([^"]*)"/);
    if (styleMatch) {
      const existingStyle = styleMatch[1] ?? "";
      return tag.replace(
        styleMatch[0],
        ` style="${utilityStyles}; ${existingStyle.replace(/;?\s*$/, "")}"`,
      );
    }

    return tag.replace(classMatch[0], `${classMatch[0]} style="${utilityStyles}"`);
  });
}

const importReactDomServer = async (): Promise<ReactDomServerModule> => {
  try {
    const server = (await import("react-dom/server.edge")) as ReactDomServerModule;
    return server.default ?? server;
  } catch {
    const server = (await import("react-dom/server")) as ReactDomServerModule;
    return server.default ?? server;
  }
};

/**
 * Render an email template component to HTML string.
 */
export const render = async (component: React.ReactNode): Promise<string> => {
  const reactDomServer = await importReactDomServer();
  const element = React.createElement(React.Suspense, undefined, component);

  if (reactDomServer.renderToReadableStream) {
    let renderError: unknown;
    const stream = await reactDomServer.renderToReadableStream(element, {
      onError(error) {
        renderError = error;
      },
      progressiveChunkSize: Number.POSITIVE_INFINITY,
    });

    await stream.allReady;

    if (renderError) {
      throw renderError;
    }

    const html = await new Response(stream).text();
    return inlineEmailUtilityStyles(`${doctype}${html.replace(/<!DOCTYPE.*?>/, "")}`);
  }

  if (reactDomServer.renderToString) {
    const html = reactDomServer.renderToString(element);
    return inlineEmailUtilityStyles(`${doctype}${html.replace(/<!DOCTYPE.*?>/, "")}`);
  }

  throw new Error("No compatible React DOM server renderer is available.");
};
