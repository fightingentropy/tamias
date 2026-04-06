import { createFileRoute } from "@tanstack/react-router"
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { getWebsiteFaviconUrl } from "@/utils/logos";
import { getTRPCClient } from "@/trpc/server";
import {
  buildOgSvgDocument,
  editorDocToLines,
  escapeXml,
  fetchDataUri,
  loadHedvigSansFontCss,
  loadHedvigSerifFontCss,
  renderPngResponse,
} from "@/start/og";

export const Route = createAppPublicFileRoute("/i/$token/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const client = await getTRPCClient();
        const invoice = await client.invoice.getInvoiceByToken
          .query({
            token: params.token,
          })
          .catch(() => null);

        if (!invoice) {
          return new Response("Not found", { status: 404 });
        }

        const customerName =
          invoice.customerName || invoice.customer?.name || invoice.template.title;
        const logoDataUri = await fetchDataUri(
          invoice.template.logoUrl ||
            getWebsiteFaviconUrl(invoice.customer?.website, 128),
        );
        const [sansFontCss, serifFontCss] = await Promise.all([
          loadHedvigSansFontCss(),
          loadHedvigSerifFontCss(),
        ]);
        const dateFormat = invoice.template.dateFormat || "dd/MM/yyyy";
        const invoiceNumber = invoice.invoiceNumber || "—";
        const issueDate = invoice.issueDate
          ? format(new TZDate(invoice.issueDate, "UTC"), dateFormat)
          : "—";
        const dueDate = invoice.dueDate
          ? format(new TZDate(invoice.dueDate, "UTC"), dateFormat)
          : "—";
        const fromLines = editorDocToLines(invoice.fromDetails);
        const customerLines = editorDocToLines(invoice.customerDetails);
        const status = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
        const metaRows: Array<[string | undefined, string]> = [
          [invoice.template.invoiceNoLabel, invoiceNumber],
          [invoice.template.issueDateLabel, issueDate],
          [invoice.template.dueDateLabel, dueDate],
        ];

        const renderLines = (lines: string[]) =>
          lines.length
            ? lines
                .map(
                  (line) => `
                    <div style="color:#fff;font-size:20px;line-height:1.45;word-break:break-word;">${escapeXml(
                      line,
                    )}</div>`,
                )
                .join("")
            : `<div style="color:#878787;font-size:20px;line-height:1.45;">—</div>`;

        const svg = buildOgSvgDocument({
          fontCss: `${sansFontCss}${serifFontCss}`,
          body: `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;box-sizing:border-box;padding:56px 64px 48px;font-family:hedvig-sans;color:#fff;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:36px;gap:24px;">
                <div style="display:flex;align-items:center;gap:16px;min-width:0;">
                  ${
                    logoDataUri
                      ? `<img src="${escapeXml(logoDataUri)}" alt="${escapeXml(
                          customerName,
                        )}" style="width:96px;height:96px;object-fit:contain;display:block;" />`
                      : `<div style="width:96px;height:96px;border-radius:24px;border:1px solid #2D2D2D;background:#1C1C1C;color:#F2F2F2;display:flex;align-items:center;justify-content:center;font-size:40px;line-height:1;">${escapeXml(
                          customerName[0]?.toUpperCase() || "I",
                        )}</div>`
                  }
                  <div style="display:flex;flex-direction:column;min-width:0;">
                    <div style="color:#878787;font-size:18px;line-height:1;margin-bottom:8px;">${escapeXml(
                      invoice.template.title,
                    )}</div>
                    <div style="color:#fff;font-size:36px;font-weight:700;line-height:1.05;word-break:break-word;">${escapeXml(
                      customerName,
                    )}</div>
                  </div>
                </div>
                <div style="padding:12px 18px;border-radius:999px;background:#1C1C1C;border:1px solid #2D2D2D;color:#fff;font-size:18px;line-height:1;font-weight:700;">${escapeXml(
                  status,
                )}</div>
              </div>

              <div style="display:flex;flex-direction:column;gap:22px;flex:1;min-width:0;">
                <div style="display:flex;flex-direction:column;gap:14px;max-width:1000px;">
                  <div style="color:#858585;font-size:20px;line-height:1;">${escapeXml(
                    invoice.template.fromLabel,
                  )}</div>
                  <div style="color:#fff;font-size:58px;font-weight:700;line-height:1.05;max-width:900px;word-break:break-word;">${escapeXml(
                    customerName,
                  )}</div>
                </div>

                <div style="display:flex;gap:32px;flex-wrap:wrap;margin-top:4px;">
                  ${metaRows
                    .map(
                      ([label, value]) => `
                        <div style="display:flex;flex-direction:column;min-width:180px;flex:1;">
                          <div style="color:#858585;font-size:18px;line-height:1;margin-bottom:8px;">${escapeXml(
                            label || "—",
                          )}</div>
                          <div style="color:#fff;font-size:24px;line-height:1.2;word-break:break-word;">${escapeXml(
                            value,
                          )}</div>
                        </div>`,
                    )
                    .join("")}
                </div>

                <div style="display:flex;gap:48px;margin-top:8px;flex:1;min-height:0;">
                  <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
                    <div style="color:#858585;font-size:20px;line-height:1;margin-bottom:10px;">${escapeXml(
                      invoice.template.fromLabel,
                    )}</div>
                    <div style="display:flex;flex-direction:column;gap:4px;max-width:100%;overflow:hidden;">${renderLines(
                      fromLines,
                    )}</div>
                  </div>
                  <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
                    <div style="color:#858585;font-size:20px;line-height:1;margin-bottom:10px;">${escapeXml(
                      invoice.template.customerLabel,
                    )}</div>
                    <div style="display:flex;flex-direction:column;gap:4px;max-width:100%;overflow:hidden;">${renderLines(
                      customerLines,
                    )}</div>
                  </div>
                </div>
              </div>
            </div>
          `,
        });

        return renderPngResponse(svg);
      },
    },
  },
});
