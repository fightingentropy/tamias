import type { AccountsAttachmentRenderData } from "../types";
import { renderBalanceSheetPage } from "./balance-sheet";
import { renderCompanyInformationPage } from "./company-information";
import { renderNotesPage } from "./notes";

export function renderAccountsAttachmentBodySections(data: AccountsAttachmentRenderData) {
  return `
    ${renderCompanyInformationPage(data)}

    ${renderBalanceSheetPage(data)}

    ${renderNotesPage(data)}`;
}
