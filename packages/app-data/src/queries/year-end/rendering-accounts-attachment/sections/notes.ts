import { escapeXml, formatDraftAmount } from "../../formatting";
import {
  formatIxbrlAmount,
  formatIxbrlWholeNumber,
  renderBulletList,
} from "../../rendering-ixbrl";
import type { AccountsAttachmentRenderData } from "../types";
import { renderAccountsPageHeader } from "./common";

function renderReviewNotesSection(data: AccountsAttachmentRenderData) {
  if (data.draft.filingReadiness.isReady) {
    return "";
  }

  return `<div class="section">
          <h2>Review notes</h2>
          <div class="review-columns">
            <div>
              <strong>Review items</strong>
              ${renderBulletList(data.draft.reviewItems)}
            </div>
            <div>
              <strong>Limitations</strong>
              ${renderBulletList(data.draft.limitations)}
            </div>
          </div>
        </div>`;
}

export function renderNotesPage(data: AccountsAttachmentRenderData) {
  const { draft } = data;

  return `<div class="accountspage">
      ${renderAccountsPageHeader(data)}

      <div id="notes" class="section">
        <h3 class="middle">Notes to the financial statements</h3>
        <p class="dotted-line"></p>
        <div class="section">
          <h2>Profit and loss summary</h2>
          <table class="notes-table">
            <thead>
              <tr><th>Line</th><th class="amount">Tagged value</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Profit or loss before tax</td>
                <td class="amount"><ix:nonFraction name="core:ProfitLossBeforeTax" contextRef="${data.durationContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                  data.profitBeforeTax,
                )}</ix:nonFraction></td>
              </tr>
              <tr>
                <td>Current tax for period</td>
                <td class="amount"><ix:nonFraction name="core:CurrentTaxForPeriod" contextRef="${data.durationContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                  data.currentTaxForPeriod,
                )}</ix:nonFraction></td>
              </tr>
              <tr>
                <td>Profit or loss</td>
                <td class="amount"><ix:nonFraction name="core:ProfitLoss" contextRef="${data.durationContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                  data.profitAfterTax,
                )}</ix:nonFraction></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Share capital and employees</h2>
          <table class="notes-table">
            <thead>
              <tr><th>Line</th><th class="amount">Tagged value</th></tr>
            </thead>
            <tbody>
              ${
                draft.ordinaryShareCount != null
                  ? `<tr>
                <td>Ordinary shares in issue</td>
                <td class="amount"><ix:nonFraction name="core:NumberOrdinarySharesInIssueExcludingTreasuryOwnShares" contextRef="${data.instantContextId}" unitRef="${data.sharesUnitId}" decimals="0">${formatIxbrlWholeNumber(
                  draft.ordinaryShareCount,
                )}</ix:nonFraction></td>
              </tr>
              <tr>
                <td>Shares issued and fully paid</td>
                <td class="amount"><ix:nonFraction name="core:NumberSharesIssuedFullyPaid" contextRef="${data.instantContextId}" unitRef="${data.sharesUnitId}" decimals="0">${formatIxbrlWholeNumber(
                  draft.ordinaryShareCount,
                )}</ix:nonFraction></td>
              </tr>`
                  : ""
              }
              ${
                draft.statementOfFinancialPosition.shareCapital
                  ? `<tr>
                <td>Nominal value of allotted share capital</td>
                <td class="amount"><ix:nonFraction name="core:NominalValueAllottedShareCapital" contextRef="${data.durationContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                  draft.statementOfFinancialPosition.shareCapital,
                )}</ix:nonFraction></td>
              </tr>`
                  : ""
              }
              ${
                draft.averageEmployeeCount != null
                  ? `<tr>
                <td>Average number of employees</td>
                <td class="amount"><ix:nonFraction name="core:AverageNumberEmployeesDuringPeriod" contextRef="${data.durationContextId}" unitRef="${data.pureUnitId}" decimals="0">${formatIxbrlWholeNumber(
                  draft.averageEmployeeCount,
                )}</ix:nonFraction></td>
              </tr>`
                  : ""
              }
              ${
                draft.ordinaryShareNominalValue != null
                  ? `<tr>
                <td>Nominal value per ordinary share</td>
                <td class="amount">${escapeXml(
                  formatDraftAmount(
                    draft.ordinaryShareNominalValue,
                    draft.currency,
                  ),
                )}</td>
              </tr>`
                  : ""
              }
            </tbody>
          </table>
        </div>

        ${renderReviewNotesSection(data)}
      </div>
    </div>`;
}
