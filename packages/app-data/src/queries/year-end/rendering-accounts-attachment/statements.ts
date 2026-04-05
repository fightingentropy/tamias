import { escapeXml } from "../formatting";
import type { AccountsAttachmentRenderData } from "./types";

function buildSmallCompaniesRegimeStatement() {
  return "The directors have prepared these financial statements in accordance with the provisions applicable to companies subject to the small companies regime.";
}

function buildAuditExemptionStatement() {
  return "For the year ended on the balance sheet date the company was entitled to exemption from audit under section 477 of the Companies Act 2006 relating to small companies.";
}

function buildMembersNoAuditStatement() {
  return "The members have not required the company to obtain an audit in accordance with section 476 of the Companies Act 2006.";
}

function buildDirectorsResponsibilitiesStatement() {
  return "The directors acknowledge their responsibilities for complying with the requirements of the Companies Act 2006 with respect to accounting records and the preparation of financial statements.";
}

export function buildStatementsMarkup(data: AccountsAttachmentRenderData) {
  const { draft, durationContextId } = data;

  return [
    draft.accountsPreparedUnderSmallCompaniesRegime
      ? `<li><ix:nonNumeric name="direp:StatementThatAccountsHaveBeenPreparedInAccordanceWithProvisionsSmallCompaniesRegime" contextRef="${durationContextId}">${escapeXml(
          buildSmallCompaniesRegimeStatement(),
        )}</ix:nonNumeric></li>`
      : null,
    draft.auditExemptionClaimed
      ? `<li><ix:nonNumeric name="direp:StatementThatCompanyEntitledToExemptionFromAuditUnderSection477CompaniesAct2006RelatingToSmallCompanies" contextRef="${durationContextId}">${escapeXml(
          buildAuditExemptionStatement(),
        )}</ix:nonNumeric></li>`
      : null,
    draft.membersDidNotRequireAudit
      ? `<li><ix:nonNumeric name="direp:StatementThatMembersHaveNotRequiredCompanyToObtainAnAudit" contextRef="${durationContextId}">${escapeXml(
          buildMembersNoAuditStatement(),
        )}</ix:nonNumeric></li>`
      : null,
    draft.directorsAcknowledgeResponsibilities
      ? `<li><ix:nonNumeric name="direp:StatementThatDirectorsAcknowledgeTheirResponsibilitiesUnderCompaniesAct" contextRef="${durationContextId}">${escapeXml(
          buildDirectorsResponsibilitiesStatement(),
        )}</ix:nonNumeric></li>`
      : null,
  ]
    .filter(Boolean)
    .join("");
}
