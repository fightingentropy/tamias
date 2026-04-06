import { escapeXml } from "../../formatting";
import { formatIxbrlAmount } from "../../rendering-ixbrl";
import type { AccountsAttachmentRenderData } from "../types";
import { renderAccountsPageHeader } from "./common";

function renderStatementsSection(data: AccountsAttachmentRenderData) {
  if (!data.statementsMarkup) {
    return "";
  }

  return `<div id="statements" class="section">
        <h3>Statements</h3>
        <ol class="lower-alpha">
          ${data.statementsMarkup}
        </ol>
      </div>`;
}

function renderApprovalSection(data: AccountsAttachmentRenderData) {
  const { draft, signingDirector } = data;

  if (!draft.signingDirectorName || !draft.approvalDate) {
    return "";
  }

  return `<div id="approval" class="section approval">
        <h3>Approval</h3>
        <p><ix:nonNumeric name="core:DescriptionBodyAuthorisingFinancialStatements" contextRef="${data.durationContextId}">Board of directors</ix:nonNumeric> approved these financial statements on ${escapeXml(
          data.formattedApprovalDate ?? "",
        )}.</p>
        <p>
          Signed on behalf of the board by
          ${
            signingDirector
              ? `<span class="officername"><ix:nonNumeric name="bus:NameEntityOfficer" contextRef="${signingDirector.id}">${escapeXml(
                  signingDirector.name,
                )}</ix:nonNumeric><ix:nonNumeric name="core:DirectorSigningFinancialStatements" contextRef="${signingDirector.id}"></ix:nonNumeric></span>`
              : escapeXml(draft.signingDirectorName)
          }.
        </p>
      </div>`;
}

export function renderBalanceSheetPage(data: AccountsAttachmentRenderData) {
  const { draft } = data;

  return `<div class="accountspage pagebreak">
      ${renderAccountsPageHeader(data)}

      <div id="balancesheet" class="section">
        <h3 class="middle">Balance Sheet as at ${escapeXml(data.formattedPeriodEnd)}</h3>
        <p class="dotted-line"></p>
        <table class="statement-table">
          <thead>
            <tr>
              <th>Line</th>
              <th class="amount">${escapeXml(draft.currency.toUpperCase())}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>Total assets</th>
              <td class="amount"><ix:nonFraction name="core:TotalAssets" contextRef="${data.instantContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                draft.statementOfFinancialPosition.assets,
              )}</ix:nonFraction></td>
            </tr>
            <tr>
              <th>Creditors</th>
              <td class="amount"><ix:nonFraction name="core:Creditors" contextRef="${data.instantContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                draft.statementOfFinancialPosition.liabilities,
              )}</ix:nonFraction></td>
            </tr>
            <tr>
              <th>Total assets less current liabilities</th>
              <td class="amount"><ix:nonFraction name="core:TotalAssetsLessCurrentLiabilities" contextRef="${data.instantContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                data.totalAssetsLessCurrentLiabilities,
              )}</ix:nonFraction></td>
            </tr>
            <tr class="total">
              <th>Net assets or liabilities</th>
              <td class="amount"><ix:nonFraction name="core:NetAssetsLiabilities" contextRef="${data.instantContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                draft.statementOfFinancialPosition.netAssets,
              )}</ix:nonFraction></td>
            </tr>
            ${
              Math.abs(data.currentTaxForPeriod) > 0.009
                ? `<tr>
              <th>Corporation tax payable</th>
              <td class="amount"><ix:nonFraction name="core:CorporationTaxPayable" contextRef="${data.instantContextId}" unitRef="${data.monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                data.currentTaxForPeriod,
              )}</ix:nonFraction></td>
            </tr>`
                : ""
            }
          </tbody>
        </table>
      </div>

      ${renderStatementsSection(data)}
      ${renderApprovalSection(data)}
    </div>`;
}
