import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { formatAmount } from "@tamias/utils/format";
import { getTRPCClient } from "@/trpc/server";
import {
  buildOgSvgDocument,
  escapeXml,
  fetchDataUri,
  loadHedvigSansFontCss,
  renderPngResponse,
} from "@/start/og";

export const Route = createAppPublicFileRoute("/p/$portalId/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const client = await getTRPCClient();
        const data = await client.customers.getByPortalId
          .query({
            portalId: params.portalId,
          })
          .catch(() => null);

        if (!data) {
          return new Response("Not found", { status: 404 });
        }

        const { customer, summary } = data;
        const logoDataUri = await fetchDataUri(customer.team.logoUrl);
        const fontCss = await loadHedvigSansFontCss();
        const total = formatAmount({
          amount: summary.totalAmount,
          currency: summary.currency,
        });
        const paid = formatAmount({
          amount: summary.paidAmount,
          currency: summary.currency,
        });
        const outstanding = formatAmount({
          amount: summary.outstandingAmount,
          currency: summary.currency,
        });
        const summaryRows: Array<[string, string | undefined]> = [
          ["Total", total],
          ["Paid", paid],
          ["Outstanding", outstanding],
          ["Invoices", String(summary.invoiceCount)],
        ];

        const svg = buildOgSvgDocument({
          fontCss,
          body: `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;box-sizing:border-box;padding:64px;font-family:hedvig-sans;color:#fff;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:48px;gap:24px;">
                <div style="display:flex;align-items:center;gap:16px;min-width:0;">
                  ${
                    logoDataUri
                      ? `<img src="${escapeXml(logoDataUri)}" alt="" style="width:64px;height:64px;object-fit:contain;display:block;" />`
                      : `<div style="width:64px;height:64px;border-radius:999px;border:1px solid #2D2D2D;background:#1C1C1C;color:#F2F2F2;display:flex;align-items:center;justify-content:center;font-size:32px;line-height:1;">${escapeXml(
                          customer.team.name?.[0]?.toUpperCase() || "C",
                        )}</div>`
                  }
                  <div style="display:flex;flex-direction:column;min-width:0;">
                    <div style="color:#fff;font-size:30px;line-height:1.1;word-break:break-word;">${escapeXml(
                      customer.team.name || "Customer Portal",
                    )}</div>
                  </div>
                </div>
              </div>

              <div style="display:flex;flex-direction:column;flex:1;min-width:0;">
                <div style="color:#606060;font-size:20px;line-height:1;margin-bottom:10px;">Customer Portal</div>
                <div style="color:#fff;font-size:64px;font-weight:700;line-height:1.05;max-width:900px;word-break:break-word;margin-bottom:44px;">${escapeXml(
                  customer.name,
                )}</div>

                <div style="display:flex;margin-top:auto;gap:64px;flex-wrap:wrap;">
                  ${summaryRows
                    .map(
                      ([label, value]) => `
                        <div style="display:flex;flex-direction:column;min-width:120px;">
                          <div style="color:#606060;font-size:18px;line-height:1;margin-bottom:8px;">${escapeXml(
                            label,
                          )}</div>
                          <div style="color:#fff;font-size:36px;line-height:1.1;">${escapeXml(
                            value ?? "—",
                          )}</div>
                        </div>`,
                    )
                    .join("")}
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
