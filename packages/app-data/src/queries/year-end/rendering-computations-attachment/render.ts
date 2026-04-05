import { escapeXml } from "../formatting";
import { buildComputationsAttachmentRenderData } from "./data";
import {
  renderAdjustmentMappingSection,
  renderComputationsAttachmentHeader,
  renderRateBreakdownSection,
  renderReviewSections,
  renderTaxComputationSummary,
} from "./sections";
import type { Ct600Draft } from "../types";

export function renderComputationsAttachmentIxbrl(draft: Ct600Draft) {
  const data = buildComputationsAttachmentRenderData(draft);

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"
  xmlns:ix="http://www.xbrl.org/2008/inlineXBRL"
  xmlns:fn="http://www.w3.org/2005/xpath-functions"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xbrli="http://www.xbrl.org/2003/instance"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:ct-comp="http://www.hmrc.gov.uk/schemas/ct/comp/2024-01-01"
  version="-//XBRL International//DTD XHTML Inline XBRL 1.0//EN">
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <title>${escapeXml(draft.companyName)} corporation tax computations</title>
    <style type="text/css">
      body { font-family: Georgia, "Times New Roman", serif; margin: 40px auto; max-width: 920px; color: #101828; line-height: 1.5; }
      h1, h2 { margin-bottom: 0.4rem; }
      h1 { font-size: 2rem; }
      h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #d0d5dd; padding-bottom: 0.35rem; }
      p, li, td, th { font-size: 0.95rem; }
      table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
      th, td { border-bottom: 1px solid #eaecf0; padding: 8px 0; text-align: left; vertical-align: top; }
      .amount { text-align: right; white-space: nowrap; }
      .muted { color: #475467; }
      .banner { border-radius: 10px; padding: 16px; margin: 1rem 0; }
      .banner-ready { background: #ecfdf3; border: 1px solid #86efac; }
      .banner-draft { background: #fff7ed; border: 1px solid #fdba74; }
      .meta { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 1rem; }
      .meta-card { border: 1px solid #eaecf0; border-radius: 10px; padding: 12px; }
      .meta-label { color: #475467; display: block; font-size: 0.8rem; margin-bottom: 0.25rem; }
    </style>
  </head>
  <body xml:lang="en-GB">
    ${renderComputationsAttachmentHeader(data)}
    <h1><ix:nonNumeric name="ct-comp:CompanyName" contextRef="${data.instantContextId}">${escapeXml(
      draft.companyName,
    )}</ix:nonNumeric></h1>
    <p class="muted">
      iXBRL corporation tax computation attachment for the period
      <ix:nonNumeric name="ct-comp:PeriodOfAccountStartDate" contextRef="${data.instantContextId}">${escapeXml(
        draft.periodStart,
      )}</ix:nonNumeric>
      to
      <ix:nonNumeric name="ct-comp:PeriodOfAccountEndDate" contextRef="${data.instantContextId}">${escapeXml(
        draft.periodEnd,
      )}</ix:nonNumeric>.
    </p>
    ${data.readyBanner}
    <div class="meta">
      <div class="meta-card"><span class="meta-label">Return period start</span><ix:nonNumeric name="ct-comp:StartOfPeriodCoveredByReturn" contextRef="${data.instantContextId}">${escapeXml(
        draft.periodStart,
      )}</ix:nonNumeric></div>
      <div class="meta-card"><span class="meta-label">Return period end</span><ix:nonNumeric name="ct-comp:EndOfPeriodCoveredByReturn" contextRef="${data.instantContextId}">${escapeXml(
        draft.periodEnd,
      )}</ix:nonNumeric></div>
      <div class="meta-card"><span class="meta-label">UTR</span>${escapeXml(
        draft.utr ?? "Missing",
      )}</div>
      <div class="meta-card"><span class="meta-label">Financial year</span>${draft.financialYear}</div>
    </div>

    ${renderTaxComputationSummary(data)}
    ${renderRateBreakdownSection(data)}
    ${renderAdjustmentMappingSection(draft)}
    ${renderReviewSections(draft)}
  </body>
</html>`;
}
