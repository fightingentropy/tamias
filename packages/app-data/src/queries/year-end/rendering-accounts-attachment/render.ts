import { roundCurrency } from "@tamias/compliance";
import { resolveAccountsEntityIdentifier } from "../rendering-ixbrl";
import { getSummaryAmount } from "../formatting";
import type { StatutoryAccountsDraft } from "../types";
import { buildStatementsMarkup } from "./statements";
import {
  renderAccountsAttachmentBodySections,
  renderAccountsAttachmentHeader,
} from "./sections";
import type { AccountsAttachmentRenderData } from "./types";

function buildSmallCompaniesAttachmentData(
  draft: StatutoryAccountsDraft,
): AccountsAttachmentRenderData {
  const durationContextId = "acct-duration";
  const instantContextId = "acct-instant";
  const accountsStatusContextId = "acct-duration-accounts-status";
  const accountsTypeContextId = "acct-duration-accounts-type";
  const accountingStandardsContextId = "acct-duration-accounting-standards";
  const monetaryUnitId = draft.currency.toUpperCase();
  const pureUnitId = "pure";
  const sharesUnitId = "shares";
  const currentTaxForPeriod =
    draft.corporationTax?.estimatedCorporationTaxDue ?? 0;
  const profitBeforeTax = getSummaryAmount(
    draft.profitAndLoss,
    "profit_before_tax",
  );
  const profitAfterTax = roundCurrency(profitBeforeTax - currentTaxForPeriod);
  const totalAssetsLessCurrentLiabilities = roundCurrency(
    draft.statementOfFinancialPosition.assets -
      draft.statementOfFinancialPosition.liabilities,
  );
  const isDormant = draft.dormant ?? false;
  const directorContexts = draft.directors.map((director, index) => ({
    id: `director-${index + 1}`,
    name: director,
    explicitMembers: [
      {
        dimension: "bus:EntityOfficersDimension",
        value: `bus:Director${index + 1}`,
      },
    ],
  }));
  const signingDirector = directorContexts.find(
    (context) => context.name === draft.signingDirectorName,
  );
  const formattedPeriodStart = draft.periodStart;
  const formattedPeriodEnd = draft.periodEnd;
  const formattedApprovalDate = draft.approvalDate;
  const registeredNumberText = draft.companyNumber
    ? `Registered Number ${draft.companyNumber}`
    : "Registered Number unavailable";
  const coverTitle = isDormant
    ? "Dormant accounts"
    : "Unaudited statutory accounts";

  const readyBanner = draft.filingReadiness.isReady
    ? `<div class="banner banner-ready"><strong>Filing-ready accounts attachment.</strong> This document contains the statutory disclosures and taxonomy-backed facts required for the supported small-company filing path.</div>`
    : `<div class="banner banner-draft"><strong>Draft review attachment.</strong> Clear the filing-readiness blockers before treating this accounts attachment as filing-ready.</div>`;

  const renderData: AccountsAttachmentRenderData = {
    draft,
    entity: resolveAccountsEntityIdentifier(draft),
    durationContextId,
    instantContextId,
    accountsStatusContextId,
    accountsTypeContextId,
    accountingStandardsContextId,
    monetaryUnitId,
    pureUnitId,
    sharesUnitId,
    currentTaxForPeriod,
    profitBeforeTax,
    profitAfterTax,
    totalAssetsLessCurrentLiabilities,
    isDormant,
    directorContexts,
    signingDirector,
    formattedPeriodStart,
    formattedPeriodEnd,
    formattedApprovalDate,
    registeredNumberText,
    coverTitle,
    readyBanner,
    statementsMarkup: "",
  };

  renderData.statementsMarkup = buildStatementsMarkup(renderData);

  return renderData;
}

export function renderAccountsAttachmentIxbrl(draft: StatutoryAccountsDraft) {
  const data = buildSmallCompaniesAttachmentData(draft);

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"
  xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xbrli="http://www.xbrl.org/2003/instance"
  xmlns:xbrldi="http://xbrl.org/2006/xbrldi"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:bus="http://xbrl.frc.org.uk/cd/2025-01-01/business"
  xmlns:direp="http://xbrl.frc.org.uk/reports/2025-01-01/direp"
  xmlns:core="http://xbrl.frc.org.uk/fr/2025-01-01/core">
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <title>${data.draft.companyName} accounts attachment</title>
    <style type="text/css">
      body { font-family: "Times New Roman", Times, serif; margin: 0; color: #101828; line-height: 1.45; }
      h1, h2, h3 { font-weight: bold; color: black; margin: 0; }
      h1 { font-size: 1.2rem; }
      h2 { font-size: 1rem; }
      h2.middle, h3.middle { text-align: center; }
      h3 { font-size: 0.98rem; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
      p, li, td, th, div { font-size: 0.95rem; }
      .hidden { display: none; }
      div.pagebreak { page-break-after: always; }
      div.accountspage { width: 100%; box-sizing: border-box; }
      div.titlepage { font-weight: bold; margin-top: 5em; text-align: center; }
      div.accountsheader { font-weight: bold; width: 100%; display: block; }
      div.accountsheader::after { content: ""; display: block; clear: both; }
      span.left { float: left; width: 70%; }
      span.right { float: right; width: 30%; text-align: right; }
      .dotted-line { border-top: 1px dotted #101828; margin: 1rem 0 1.5rem 0; }
      .banner { border-radius: 8px; padding: 12px 14px; margin: 1rem 0 1.25rem 0; }
      .banner-ready { background: #ecfdf3; border: 1px solid #86efac; }
      .banner-draft { background: #fff7ed; border: 1px solid #fdba74; }
      .title-subtitle { margin-top: 0.8rem; font-weight: normal; }
      .section { margin-top: 1.2cm; }
      .section:first-of-type { margin-top: 0; }
      .summary { margin-top: 0.5rem; }
      .detail-table,
      .statement-table,
      .notes-table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
      .detail-table th,
      .detail-table td,
      .statement-table th,
      .statement-table td,
      .notes-table th,
      .notes-table td { border-bottom: 1px solid #d0d5dd; padding: 8px 0; text-align: left; vertical-align: top; }
      .detail-table th { width: 32%; font-weight: normal; }
      .amount { text-align: right; white-space: nowrap; }
      .statement-table .total td,
      .statement-table .total th { border-top: 1px solid #101828; border-bottom: 2px solid #101828; font-weight: bold; }
      .statement-table .section-row th { padding-top: 1rem; font-weight: bold; }
      .lower-alpha { list-style-type: lower-alpha; padding-left: 1.5rem; margin: 0.75rem 0 0 0; }
      .lower-alpha li { margin-bottom: 0.6rem; }
      .muted { color: #475467; }
      .approval { margin-top: 1rem; }
      .review-columns { display: grid; gap: 1.2rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .review-columns ul { margin: 0.5rem 0 0 1.25rem; }
      @media screen, projection, tv {
        body { margin: 2% 4%; background-color: #d0d5dd; }
        div.accountspage { background-color: white; padding: 2em; width: 21cm; min-height: 29.7cm; margin: 2em auto; box-shadow: 0 12px 36px rgba(16, 24, 40, 0.12); }
        div.titlepage { padding: 5em 2em 2em 2em; margin: 2em auto; }
      }
      @media print {
        body { margin: 0; background: white; }
        div.accountspage { padding: 1.5cm; min-height: 27.7cm; }
        div.accountspage:last-child { page-break-after: auto; }
      }
    </style>
  </head>
  <body xml:lang="en-GB">
    ${renderAccountsAttachmentHeader(data)}
    <div class="hidden">
      <ix:nonNumeric name="bus:AccountingStandardsApplied" contextRef="${data.accountingStandardsContextId}"></ix:nonNumeric>
      <ix:nonNumeric name="bus:AccountsStatusAuditedOrUnaudited" contextRef="${data.accountsStatusContextId}"></ix:nonNumeric>
      <ix:nonNumeric name="bus:AccountsType" contextRef="${data.accountsTypeContextId}"></ix:nonNumeric>
      <ix:nonNumeric name="bus:EntityTradingStatus" contextRef="${data.durationContextId}"></ix:nonNumeric>
      <ix:nonNumeric name="bus:StartDateForPeriodCoveredByReport" contextRef="${data.instantContextId}">${data.draft.periodStart}</ix:nonNumeric>
      <ix:nonNumeric name="bus:EndDateForPeriodCoveredByReport" contextRef="${data.instantContextId}">${data.draft.periodEnd}</ix:nonNumeric>
      <ix:nonNumeric name="bus:BalanceSheetDate" contextRef="${data.instantContextId}">${data.draft.periodEnd}</ix:nonNumeric>
      <ix:nonNumeric name="bus:EntityDormantTruefalse" contextRef="${data.durationContextId}">${String(
        data.isDormant,
      )}</ix:nonNumeric>
      ${
        data.draft.approvalDate
          ? `<ix:nonNumeric name="core:DateAuthorisationFinancialStatementsForIssue" contextRef="${data.instantContextId}">${data.draft.approvalDate}</ix:nonNumeric>`
          : ""
      }
    </div>
    <div class="titlepage accountspage pagebreak">
      ${
        data.draft.companyNumber
          ? `<p>Registered Number <ix:nonNumeric name="bus:UKCompaniesHouseRegisteredNumber" contextRef="${data.durationContextId}">${data.draft.companyNumber}</ix:nonNumeric></p>`
          : `<p>${data.registeredNumberText}</p>`
      }
      <p><ix:nonNumeric name="bus:EntityCurrentLegalOrRegisteredName" contextRef="${data.durationContextId}">${data.draft.companyName}</ix:nonNumeric></p>
      <p>${data.coverTitle}</p>
      <p>For the year ended ${data.formattedPeriodEnd}</p>
      <p class="dotted-line"></p>
      <p class="title-subtitle">
        Prepared for the supported small-company filing path in ${data.draft.accountingBasis}.
      </p>
    </div>
    ${renderAccountsAttachmentBodySections(data)}
  </body>
</html>`;
}
