import { escapeHtml, formatDraftAmount, formatDraftDate } from "./formatting";
import type { StatutoryAccountsDraft } from "./types";

export function renderStatutoryAccountsDraftHtml(draft: StatutoryAccountsDraft) {
  const renderMoneyTable = (lines: Array<{ label: string; amount: number }>) =>
    lines
      .map(
        (line) => `
          <tr>
            <td>${escapeHtml(line.label)}</td>
            <td class="amount">${escapeHtml(formatDraftAmount(line.amount, draft.currency))}</td>
          </tr>`,
      )
      .join("");

  const reviewItems = draft.reviewItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const limitations = draft.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const workingPaperSections = draft.workingPaperNotes
    .map(
      (section) => `
        <section class="note">
          <h3>${escapeHtml(section.label)}</h3>
          <table>
            <thead>
              <tr><th>Line</th><th class="amount">Amount</th></tr>
            </thead>
            <tbody>
              ${renderMoneyTable(section.lines)}
              <tr class="total">
                <td>Total</td>
                <td class="amount">${escapeHtml(
                  formatDraftAmount(section.total, draft.currency),
                )}</td>
              </tr>
            </tbody>
          </table>
        </section>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(draft.companyName)} statutory accounts draft</title>
    <style>
      body { font-family: Georgia, "Times New Roman", serif; margin: 40px auto; max-width: 920px; color: #101828; line-height: 1.5; }
      h1, h2, h3 { margin-bottom: 0.4rem; }
      h1 { font-size: 2rem; }
      h2 { font-size: 1.2rem; margin-top: 2rem; border-bottom: 1px solid #d0d5dd; padding-bottom: 0.35rem; }
      h3 { font-size: 1rem; margin-top: 1.4rem; }
      p, li { font-size: 0.95rem; }
      .meta, .banner { background: #f8fafc; border: 1px solid #d0d5dd; border-radius: 10px; padding: 16px; margin: 1rem 0; }
      .banner { background: #fff7ed; border-color: #fdba74; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .label { color: #475467; font-size: 0.85rem; display: block; }
      .value { font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
      th, td { border-bottom: 1px solid #eaecf0; padding: 8px 0; text-align: left; vertical-align: top; }
      .amount { text-align: right; white-space: nowrap; }
      .total td { font-weight: 700; }
      .muted { color: #475467; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(draft.companyName)}</h1>
    <p class="muted">Draft statutory accounts pack for the period ${escapeHtml(
      formatDraftDate(draft.periodStart),
    )} to ${escapeHtml(formatDraftDate(draft.periodEnd))}</p>

    <div class="banner">
      <strong>${escapeHtml(
        draft.filingReadiness.isReady ? "Supported-path filing ready." : "Draft only.",
      )}</strong>
      ${
        draft.filingReadiness.isReady
          ? escapeHtml(
              `This review document matches the supported filing-ready path: ${draft.filingReadiness.supportedPath}. Use the generated iXBRL attachments for submission.`,
            )
          : "This document is generated from the Tamias year-end pack for review and accountant handoff. It is not filing-ready."
      }
    </div>

    <div class="meta">
      <div class="grid">
        <div><span class="label">Company number</span><span class="value">${escapeHtml(
          draft.companyNumber ?? "Missing",
        )}</span></div>
        <div><span class="label">Accounts due</span><span class="value">${escapeHtml(
          formatDraftDate(draft.accountsDueDate),
        )}</span></div>
        <div><span class="label">Currency</span><span class="value">${escapeHtml(
          draft.currency,
        )}</span></div>
        <div><span class="label">Accounting basis</span><span class="value">${escapeHtml(
          draft.accountingBasis,
        )}</span></div>
        <div><span class="label">Generated</span><span class="value">${escapeHtml(
          formatDraftDate(draft.generatedAt),
        )}</span></div>
      </div>
    </div>

    <h2>Statement Of Financial Position</h2>
    <table>
      <tbody>
        ${renderMoneyTable([
          {
            label: "Assets",
            amount: draft.statementOfFinancialPosition.assets,
          },
          {
            label: "Liabilities",
            amount: draft.statementOfFinancialPosition.liabilities,
          },
          {
            label: "Net assets",
            amount: draft.statementOfFinancialPosition.netAssets,
          },
          {
            label: "Called up share capital",
            amount: draft.statementOfFinancialPosition.shareCapital,
          },
          {
            label: "Retained earnings",
            amount: draft.statementOfFinancialPosition.retainedEarnings,
          },
          {
            label: "Other reserves",
            amount: draft.statementOfFinancialPosition.otherReserves,
          },
          {
            label: "Total equity",
            amount: draft.statementOfFinancialPosition.totalEquity,
          },
        ])}
      </tbody>
    </table>

    <h2>Profit And Loss Summary</h2>
    <table>
      <tbody>
        ${renderMoneyTable(
          draft.profitAndLoss.map((line) => ({
            label: line.label,
            amount: line.amount,
          })),
        )}
      </tbody>
    </table>

    <h2>Retained Earnings</h2>
    <table>
      <tbody>
        ${renderMoneyTable([
          {
            label: "Opening balance",
            amount: draft.retainedEarnings.openingBalance,
          },
          {
            label: "Current period profit",
            amount: draft.retainedEarnings.currentPeriodProfit,
          },
          {
            label: "Manual equity adjustments",
            amount: draft.retainedEarnings.manualEquityAdjustments,
          },
          {
            label: "Closing balance",
            amount: draft.retainedEarnings.closingBalance,
          },
        ])}
      </tbody>
    </table>

    <h2>Corporation Tax Schedule</h2>
    <table>
      <tbody>
        ${renderMoneyTable([
          {
            label: "Accounting profit before tax",
            amount: draft.corporationTax?.accountingProfitBeforeTax ?? 0,
          },
          {
            label: "Manual tax adjustments",
            amount: draft.corporationTax?.manualAdjustmentsTotal ?? 0,
          },
          {
            label: "Taxable profit",
            amount: draft.corporationTax?.taxableProfit ?? 0,
          },
          {
            label: "Estimated corporation tax due",
            amount: draft.corporationTax?.estimatedCorporationTaxDue ?? 0,
          },
        ])}
      </tbody>
    </table>

    <h2>Supporting Notes</h2>
    ${workingPaperSections}

    <h2>Review Items</h2>
    <ul>${reviewItems}</ul>

    <h2>Limitations</h2>
    <ul>${limitations}</ul>
  </body>
</html>`;
}
