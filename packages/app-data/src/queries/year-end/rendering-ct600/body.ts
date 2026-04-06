import { escapeXml } from "../formatting";
import type { Ct600Draft } from "../types";
import { renderCt600AttachedFilesXml, renderCt600ReturnInfoSummaryXml } from "./attachments";
import { renderCorporationTaxChargeableXml } from "./corporation-tax";
import { renderCt600aXml } from "./ct600a";
import { formatMoney } from "./shared";

export function renderCt600DraftBodyXml(args: {
  draft: Ct600Draft;
  submissionReference: string;
  irMark?: string;
  encodedAccountsAttachment?: string;
  encodedComputationsAttachment?: string;
}) {
  const registrationNumber = args.draft.companyNumber ?? "MISSING-COMPANY-NUMBER";
  const ct600aSupplement = args.draft.supplementaryPages.ct600a;
  const returnInfoSummary = renderCt600ReturnInfoSummaryXml({
    encodedAccountsAttachment: args.encodedAccountsAttachment,
    encodedComputationsAttachment: args.encodedComputationsAttachment,
    hasCt600aSupplement: Boolean(ct600aSupplement),
  });
  const attachedFiles = renderCt600AttachedFilesXml({
    encodedAccountsAttachment: args.encodedAccountsAttachment,
    encodedComputationsAttachment: args.encodedComputationsAttachment,
  });
  const ct600aXml = renderCt600aXml(args.draft);
  const corporationTaxChargeableXml = renderCorporationTaxChargeableXml(args.draft);

  return `<Body><IRenvelope xmlns="http://www.govtalk.gov.uk/taxation/CT/5"><IRheader><Keys><Key Type="UTR">${escapeXml(args.submissionReference)}</Key></Keys><PeriodEnd>${escapeXml(args.draft.periodEnd)}</PeriodEnd><DefaultCurrency>${escapeXml(args.draft.currency)}</DefaultCurrency><Manifest><Contains><Reference><Namespace>http://www.govtalk.gov.uk/taxation/CT/5</Namespace><SchemaVersion>2022-v1.99</SchemaVersion><TopElementName>CompanyTaxReturn</TopElementName></Reference></Contains></Manifest>${
    args.irMark ? `<IRmark Type="generic">${escapeXml(args.irMark)}</IRmark>` : ""
  }<Sender>Company</Sender></IRheader><CompanyTaxReturn ReturnType="${escapeXml(
    args.draft.returnType,
  )}"><CompanyInformation><CompanyName>${escapeXml(
    args.draft.companyName,
  )}</CompanyName><RegistrationNumber>${escapeXml(
    registrationNumber,
  )}</RegistrationNumber><Reference>${escapeXml(
    args.submissionReference,
  )}</Reference><CompanyType>${args.draft.companyType}</CompanyType><PeriodCovered><From>${escapeXml(
    args.draft.periodStart,
  )}</From><To>${escapeXml(
    args.draft.periodEnd,
  )}</To></PeriodCovered></CompanyInformation>${returnInfoSummary}<Turnover><Total>${formatMoney(
    args.draft.turnover,
  )}</Total></Turnover><CompanyTaxCalculation><Income><Trading><Profits>${formatMoney(
    args.draft.tradingProfits,
  )}</Profits><LossesBroughtForward>${formatMoney(
    args.draft.lossesBroughtForward,
  )}</LossesBroughtForward><NetProfits>${formatMoney(
    args.draft.netProfits,
  )}</NetProfits></Trading></Income><ProfitsBeforeOtherDeductions>${formatMoney(
    args.draft.profitsBeforeOtherDeductions,
  )}</ProfitsBeforeOtherDeductions><ChargesAndReliefs><ProfitsBeforeDonationsAndGroupRelief>${formatMoney(
    args.draft.profitsBeforeDonationsAndGroupRelief,
  )}</ProfitsBeforeDonationsAndGroupRelief></ChargesAndReliefs><ChargeableProfits>${formatMoney(
    args.draft.chargeableProfits,
  )}</ChargeableProfits><CorporationTaxChargeable>${corporationTaxChargeableXml}</CorporationTaxChargeable><CorporationTax>${formatMoney(
    args.draft.corporationTax,
  )}</CorporationTax>${
    args.draft.marginalRelief > 0
      ? `<MarginalReliefForRingFenceTrades>${formatMoney(
          args.draft.marginalRelief,
        )}</MarginalReliefForRingFenceTrades>`
      : ""
  }<NetCorporationTaxChargeable>${formatMoney(
    args.draft.netCorporationTaxChargeable,
  )}</NetCorporationTaxChargeable><TaxReliefsAndDeductions><TotalReliefsAndDeductions>0.00</TotalReliefsAndDeductions></TaxReliefsAndDeductions></CompanyTaxCalculation><CalculationOfTaxOutstandingOrOverpaid><NetCorporationTaxLiability>${formatMoney(
    args.draft.netCorporationTaxLiability,
  )}</NetCorporationTaxLiability><TaxChargeable>${formatMoney(
    args.draft.taxChargeable,
  )}</TaxChargeable>${
    ct600aSupplement
      ? `<LoansToParticipators>${formatMoney(
          args.draft.loansToParticipatorsTax,
        )}</LoansToParticipators>`
      : ""
  }${
    args.draft.ct600AReliefDue ? "<CT600AreliefDue>yes</CT600AreliefDue>" : ""
  }<TaxPayable>${formatMoney(
    args.draft.taxPayable,
  )}</TaxPayable></CalculationOfTaxOutstandingOrOverpaid><Declaration><AcceptDeclaration>yes</AcceptDeclaration><Name>${escapeXml(
    args.draft.declarationName,
  )}</Name><Status>${escapeXml(args.draft.declarationStatus)}</Status></Declaration>${ct600aXml}${
    attachedFiles
      ? `<AttachedFiles><XBRLsubmission>${attachedFiles}</XBRLsubmission></AttachedFiles>`
      : ""
  }</CompanyTaxReturn></IRenvelope></Body>`;
}
