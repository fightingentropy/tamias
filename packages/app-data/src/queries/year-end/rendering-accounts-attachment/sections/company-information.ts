import { escapeXml, formatDraftDate } from "../../formatting";
import type { AccountsAttachmentRenderData } from "../types";
import { renderAccountsPageHeader, renderDirectorMarkup } from "./common";

export function renderCompanyInformationPage(
  data: AccountsAttachmentRenderData,
) {
  const { draft } = data;

  return `<div class="accountspage pagebreak">
      ${renderAccountsPageHeader(data)}

      <div class="section">
        <h3 class="middle">Company information</h3>
        <p class="dotted-line"></p>
        ${data.readyBanner}
        <p class="summary">
          Statutory accounts for the period ${escapeXml(data.formattedPeriodStart)} to
          ${escapeXml(data.formattedPeriodEnd)}.
        </p>
        <table class="detail-table">
          <tbody>
            <tr>
              <th>Balance sheet date</th>
              <td>${escapeXml(data.formattedPeriodEnd)}</td>
            </tr>
            <tr>
              <th>Accounts due date</th>
              <td>${escapeXml(formatDraftDate(draft.accountsDueDate))}</td>
            </tr>
            <tr>
              <th>Accounting basis</th>
              <td>${escapeXml(draft.accountingBasis)}</td>
            </tr>
            <tr>
              <th>Reporting currency</th>
              <td>${escapeXml(draft.currency.toUpperCase())}</td>
            </tr>
            <tr>
              <th>Dormant company</th>
              <td>${escapeXml(data.isDormant ? "Yes" : "No")}</td>
            </tr>
            ${
              draft.principalActivity
                ? `<tr>
              <th>Principal activity</th>
              <td><ix:nonNumeric name="bus:DescriptionPrincipalActivities" contextRef="${data.durationContextId}">${escapeXml(
                draft.principalActivity,
              )}</ix:nonNumeric></td>
            </tr>`
                : ""
            }
            ${renderDirectorMarkup(data)}
          </tbody>
        </table>
      </div>
    </div>`;
}
