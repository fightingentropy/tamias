import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { getChartDisplayName } from "@/components/metrics/utils/chart-types";
import {
  buildOgSvgDocument,
  escapeXml,
  fetchDataUri,
  loadHedvigSansFontCss,
  loadHedvigSerifFontCss,
  renderPngResponse,
} from "@/start/og";

export const Route = createFileRoute("/r/$linkId/opengraph-image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { getReportByLinkIdLocally } = await import(
          "@/server/loaders/public"
        );
        const report = await getReportByLinkIdLocally(params.linkId);

        if (!report) {
          return new Response("Not found", { status: 404 });
        }

        if (report.expireAt && new Date(report.expireAt) < new Date()) {
          return new Response("Not found", { status: 404 });
        }

        const chartName = getChartDisplayName(report.type as any);
        const fromDate = parseISO(report.from!);
        const toDate = parseISO(report.to!);
        const dateRangeDisplay = `${format(fromDate, "MMM d")} - ${format(
          toDate,
          "MMM d, yyyy",
        )}`;
        const teamName = report.teamName || "Company";
        const logoDataUri = await fetchDataUri(report.teamLogoUrl);
        const [sansFontCss, serifFontCss] = await Promise.all([
          loadHedvigSansFontCss(),
          loadHedvigSerifFontCss(),
        ]);

        const svg = buildOgSvgDocument({
          fontCss: `${sansFontCss}${serifFontCss}`,
          body: `
            <div style="width:100%;height:100%;display:flex;flex-direction:column;box-sizing:border-box;padding:64px;font-family:hedvig-sans;color:#fff;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:48px;width:100%;">
                ${
                  logoDataUri
                    ? `<img src="${escapeXml(logoDataUri)}" alt="${escapeXml(
                        teamName,
                      )}" style="width:64px;height:64px;border-radius:999px;overflow:hidden;object-fit:cover;display:block;border:1px solid #2D2D2D;" />`
                    : `<div style="width:64px;height:64px;border-radius:999px;border:1px solid #2D2D2D;background:#1C1C1C;color:#F2F2F2;display:flex;align-items:center;justify-content:center;font-size:32px;line-height:1;">${escapeXml(
                        teamName[0]?.toUpperCase() || "C",
                      )}</div>`
                }
              </div>

              <div style="display:flex;flex-direction:column;flex:1;justify-content:center;align-items:center;text-align:center;min-width:0;">
                <div style="color:#fff;font-size:84px;line-height:1.02;font-family:hedvig-serif;max-width:980px;word-break:break-word;margin-bottom:18px;">${escapeXml(
                  chartName,
                )}</div>
                <div style="color:#fff;font-size:40px;line-height:1.15;max-width:880px;word-break:break-word;margin-bottom:24px;">${escapeXml(
                  teamName,
                )}</div>
                <div style="color:#858585;font-size:28px;line-height:1.2;">${escapeXml(
                  dateRangeDisplay,
                )}</div>
              </div>
            </div>
          `,
        });

        return renderPngResponse(svg, "public, max-age=3600, s-maxage=3600");
      },
    },
  },
});
