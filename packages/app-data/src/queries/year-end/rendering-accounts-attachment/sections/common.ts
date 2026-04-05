import { escapeXml } from "../../formatting";
import type { AccountsAttachmentRenderData } from "../types";

export function renderAccountsPageHeader(data: AccountsAttachmentRenderData) {
  return `<div class="accountsheader">
        <h2>
          <span class="left">${escapeXml(data.draft.companyName)}</span>
          <span class="right">${escapeXml(data.registeredNumberText)}</span>
        </h2>
      </div>`;
}

export function renderDirectorMarkup(data: AccountsAttachmentRenderData) {
  if (data.directorContexts.length === 0) {
    return "";
  }

  return `<tr>
              <th>Directors</th>
              <td>${data.directorContexts
                .map(
                  (context) =>
                    `<div><ix:nonNumeric name="bus:NameEntityOfficer" contextRef="${context.id}">${escapeXml(
                      context.name,
                    )}</ix:nonNumeric></div>`,
                )
                .join("")}</td>
            </tr>`;
}
