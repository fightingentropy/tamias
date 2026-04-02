import { createHash } from "node:crypto";
import { roundCurrency } from "@tamias/compliance";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  type Ct600Draft,
  escapeHtml,
  escapeXml,
  formatDraftAmount,
  formatDraftDate,
  getHmrcCtEnvironment,
  getHmrcCtRuntimeStatus,
  getSummaryAmount,
  HMRC_ACCEPTED_FRC_2025_FRS_102_ENTRY_POINT,
  HMRC_CT_COMPUTATIONS_2024_ENTRY_POINT,
  humanizeToken,
  SMALL_PROFITS_RATE_START,
  type StatutoryAccountsDraft,
} from "./shared";

function inclusiveDayCount(start: Date, end: Date) {
  return differenceInCalendarDays(end, start) + 1;
}

function stripUtf8ByteOrderMark(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function stripLeadingXmlDeclaration(value: string) {
  return value.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
}

function stripInlineDoctype(value: string) {
  return value.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");
}

function normalizeInlineXbrlDocumentForCtSubmission(value: string) {
  return stripInlineDoctype(
    stripLeadingXmlDeclaration(stripUtf8ByteOrderMark(value)),
  ).trim();
}

function encodeInlineXbrlDocumentForCtSubmission(value: string) {
  return Buffer.from(
    normalizeInlineXbrlDocumentForCtSubmission(value),
    "utf8",
  ).toString("base64");
}

function renderCt600DraftBodyXml(args: {
  draft: Ct600Draft;
  submissionReference: string;
  irMark?: string;
  encodedAccountsAttachment?: string;
  encodedComputationsAttachment?: string;
}) {
  const registrationNumber =
    args.draft.companyNumber ?? "MISSING-COMPANY-NUMBER";
  const formatMoney = (value: number) => roundCurrency(value).toFixed(2);
  const ct600aSupplement = args.draft.supplementaryPages.ct600a;
  const supplementaryPagesXml = ct600aSupplement
    ? "<SupplementaryPages><CT600A>yes</CT600A></SupplementaryPages>"
    : "";
  const returnInfoSummary = `<ReturnInfoSummary><Accounts>${
    args.encodedAccountsAttachment
      ? "<ThisPeriodAccounts>yes</ThisPeriodAccounts>"
      : "<NoAccountsReason>NO_ACCOUNTS_ATTACHMENT_GENERATED</NoAccountsReason>"
  }</Accounts><Computations>${
    args.encodedComputationsAttachment
      ? "<ThisPeriodComputations>yes</ThisPeriodComputations>"
      : "<NoComputationsReason>NO_COMPUTATION_ATTACHMENT_GENERATED</NoComputationsReason>"
  }</Computations>${supplementaryPagesXml}</ReturnInfoSummary>`;
  const attachedFiles = [
    args.encodedAccountsAttachment
      ? `<Accounts><Instance><EncodedInlineXBRLDocument>${args.encodedAccountsAttachment}</EncodedInlineXBRLDocument></Instance></Accounts>`
      : null,
    args.encodedComputationsAttachment
      ? `<Computation><Instance><EncodedInlineXBRLDocument>${args.encodedComputationsAttachment}</EncodedInlineXBRLDocument></Instance></Computation>`
      : null,
  ]
    .filter(Boolean)
    .join("");
  const ct600aXml = ct600aSupplement
    ? `<LoansByCloseCompanies><BeforeEndPeriod>${
        ct600aSupplement.beforeEndPeriod ? "yes" : "no"
      }</BeforeEndPeriod>${
        ct600aSupplement.loansInformation
          ? `<LoansInformation>${ct600aSupplement.loansInformation.loans
              .map(
                (loan) =>
                  `<Loan><Name>${escapeXml(
                    loan.name,
                  )}</Name><AmountOfLoan>${formatMoney(
                    loan.amountOfLoan,
                  )}</AmountOfLoan></Loan>`,
              )
              .join("")}<TotalLoans>${formatMoney(
              ct600aSupplement.loansInformation.totalLoans,
            )}</TotalLoans><TaxChargeable>${formatMoney(
              ct600aSupplement.loansInformation.taxChargeable,
            )}</TaxChargeable></LoansInformation>`
          : ""
      }${
        ct600aSupplement.reliefEarlierThan
          ? `<ReliefEarlierThan>${ct600aSupplement.reliefEarlierThan.loans
              .map(
                (loan) =>
                  `<Loan><Name>${escapeXml(loan.name)}</Name>${
                    loan.amountRepaid != null
                      ? `<AmountRepaid>${formatMoney(
                          loan.amountRepaid,
                        )}</AmountRepaid>`
                      : ""
                  }${
                    loan.amountReleasedOrWrittenOff != null
                      ? `<AmountReleasedOrWrittenOff>${formatMoney(
                          loan.amountReleasedOrWrittenOff,
                        )}</AmountReleasedOrWrittenOff>`
                      : ""
                  }<Date>${escapeXml(loan.date)}</Date></Loan>`,
              )
              .join("")}${
              ct600aSupplement.reliefEarlierThan.totalAmountRepaid != null
                ? `<TotalAmountRepaid>${formatMoney(
                    ct600aSupplement.reliefEarlierThan.totalAmountRepaid,
                  )}</TotalAmountRepaid>`
                : ""
            }${
              ct600aSupplement.reliefEarlierThan.totalAmountReleasedOrWritten !=
              null
                ? `<TotalAmountReleasedOrWritten>${formatMoney(
                    ct600aSupplement.reliefEarlierThan
                      .totalAmountReleasedOrWritten,
                  )}</TotalAmountReleasedOrWritten>`
                : ""
            }<TotalLoans>${formatMoney(
              ct600aSupplement.reliefEarlierThan.totalLoans,
            )}</TotalLoans><ReliefDue>${formatMoney(
              ct600aSupplement.reliefEarlierThan.reliefDue,
            )}</ReliefDue></ReliefEarlierThan>`
          : ""
      }${
        ct600aSupplement.loanLaterReliefNow
          ? `<LoanLaterReliefNow>${ct600aSupplement.loanLaterReliefNow.loans
              .map(
                (loan) =>
                  `<Loan><Name>${escapeXml(loan.name)}</Name>${
                    loan.amountRepaid != null
                      ? `<AmountRepaid>${formatMoney(
                          loan.amountRepaid,
                        )}</AmountRepaid>`
                      : ""
                  }${
                    loan.amountReleasedOrWrittenOff != null
                      ? `<AmountReleasedOrWrittenOff>${formatMoney(
                          loan.amountReleasedOrWrittenOff,
                        )}</AmountReleasedOrWrittenOff>`
                      : ""
                  }<Date>${escapeXml(loan.date)}</Date></Loan>`,
              )
              .join("")}${
              ct600aSupplement.loanLaterReliefNow.totalAmountRepaid != null
                ? `<TotalAmountRepaid>${formatMoney(
                    ct600aSupplement.loanLaterReliefNow.totalAmountRepaid,
                  )}</TotalAmountRepaid>`
                : ""
            }${
              ct600aSupplement.loanLaterReliefNow
                .totalAmountReleasedOrWritten != null
                ? `<TotalAmountReleasedOrWritten>${formatMoney(
                    ct600aSupplement.loanLaterReliefNow
                      .totalAmountReleasedOrWritten,
                  )}</TotalAmountReleasedOrWritten>`
                : ""
            }<TotalLoans>${formatMoney(
              ct600aSupplement.loanLaterReliefNow.totalLoans,
            )}</TotalLoans><ReliefDue>${formatMoney(
              ct600aSupplement.loanLaterReliefNow.reliefDue,
            )}</ReliefDue></LoanLaterReliefNow>`
          : ""
      }${
        ct600aSupplement.totalLoansOutstanding != null
          ? `<TotalLoansOutstanding>${formatMoney(
              ct600aSupplement.totalLoansOutstanding,
            )}</TotalLoansOutstanding>`
          : ""
      }<TaxPayable>${formatMoney(
        ct600aSupplement.taxPayable,
      )}</TaxPayable></LoansByCloseCompanies>`
    : "";
  const corporationTaxFinancialYears =
    args.draft.financialYearBreakdown.length > 0
      ? args.draft.financialYearBreakdown
      : [
          {
            financialYear: args.draft.financialYear,
            periodStart: args.draft.periodStart,
            periodEnd: args.draft.periodEnd,
            daysInSegment: inclusiveDayCount(
              parseISO(args.draft.periodStart),
              parseISO(args.draft.periodEnd),
            ),
            associatedCompanies: args.draft.associatedCompaniesThisPeriod,
            chargeableProfits: args.draft.chargeableProfits,
            augmentedProfits: args.draft.augmentedProfits,
            lowerLimit: null,
            upperLimit: null,
            taxRate: args.draft.taxRate,
            grossCorporationTax: args.draft.corporationTax,
            marginalRelief: args.draft.marginalRelief,
            netCorporationTax: args.draft.netCorporationTaxChargeable,
            chargeType: "main_rate" as const,
          },
        ];
  const periodUsesSmallProfitsRules =
    parseISO(args.draft.periodEnd).getTime() >=
    parseISO(SMALL_PROFITS_RATE_START).getTime();
  const associatedCompaniesXml = periodUsesSmallProfitsRules
    ? `<AssociatedCompanies>${
        args.draft.associatedCompaniesMode === "financial_years"
          ? `<AssociatedCompaniesFinancialYears><FirstYear>${
              args.draft.associatedCompaniesFirstYear ?? 0
            }</FirstYear><SecondYear>${
              args.draft.associatedCompaniesSecondYear ?? 0
            }</SecondYear></AssociatedCompaniesFinancialYears>`
          : `<ThisPeriod>${args.draft.associatedCompaniesThisPeriod ?? 0}</ThisPeriod>`
      }${
        args.draft.startingOrSmallCompaniesRate
          ? "<StartingOrSmallCompaniesRate>yes</StartingOrSmallCompaniesRate>"
          : ""
      }</AssociatedCompanies>`
    : "";
  const financialYearChargeXml = corporationTaxFinancialYears
    .map((financialYear, index) => {
      const elementName = index === 0 ? "FinancialYearOne" : "FinancialYearTwo";

      return `<${elementName}><Year>${
        financialYear.financialYear
      }</Year><Details><Profit>${formatMoney(
        financialYear.chargeableProfits,
      )}</Profit><TaxRate>${formatMoney(
        financialYear.taxRate,
      )}</TaxRate><Tax>${formatMoney(
        financialYear.grossCorporationTax,
      )}</Tax></Details></${elementName}>`;
    })
    .join("");

  return `<Body><IRenvelope xmlns="http://www.govtalk.gov.uk/taxation/CT/5"><IRheader><Keys><Key Type="UTR">${escapeXml(args.submissionReference)}</Key></Keys><PeriodEnd>${escapeXml(args.draft.periodEnd)}</PeriodEnd><DefaultCurrency>${escapeXml(args.draft.currency)}</DefaultCurrency><Manifest><Contains><Reference><Namespace>http://www.govtalk.gov.uk/taxation/CT/5</Namespace><SchemaVersion>2022-v1.99</SchemaVersion><TopElementName>CompanyTaxReturn</TopElementName></Reference></Contains></Manifest>${
    args.irMark
      ? `<IRmark Type="generic">${escapeXml(args.irMark)}</IRmark>`
      : ""
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
  )}</ChargeableProfits><CorporationTaxChargeable>${associatedCompaniesXml}${financialYearChargeXml}</CorporationTaxChargeable><CorporationTax>${formatMoney(
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
  )}</Name><Status>${escapeXml(
    args.draft.declarationStatus,
  )}</Status></Declaration>${ct600aXml}${
    attachedFiles
      ? `<AttachedFiles><XBRLsubmission>${attachedFiles}</XBRLsubmission></AttachedFiles>`
      : ""
  }</CompanyTaxReturn></IRenvelope></Body>`;
}

function computeCt600DraftIrmark(bodyXmlWithoutIrmark: string) {
  return createHash("sha1")
    .update(bodyXmlWithoutIrmark, "utf8")
    .digest("base64");
}

function resolveHmrcCtSubmissionReference(companyUtr?: string | null) {
  return (
    getHmrcCtRuntimeStatus({
      utr: companyUtr ?? null,
    }).submissionReference ?? "MISSING-UTR"
  );
}

export function renderCt600DraftXml(
  draft: Ct600Draft,
  options?: {
    accountsAttachmentXhtml?: string;
    computationsAttachmentXhtml?: string;
  },
) {
  const environment = getHmrcCtEnvironment();
  const vendorId = process.env.HMRC_CT_VENDOR_ID ?? "0000";
  const productName = process.env.HMRC_CT_PRODUCT_NAME ?? "Tamias";
  const productVersion = process.env.HMRC_CT_PRODUCT_VERSION ?? "0.1.0-draft";
  const senderId = process.env.HMRC_CT_SENDER_ID ?? "DRAFT-SENDER-ID";
  const senderPassword =
    process.env.HMRC_CT_SENDER_PASSWORD ?? "DRAFT-SENDER-PASSWORD";
  const reference = resolveHmrcCtSubmissionReference(draft.utr);
  const encodedAccountsAttachment = options?.accountsAttachmentXhtml
    ? encodeInlineXbrlDocumentForCtSubmission(options.accountsAttachmentXhtml)
    : undefined;
  const encodedComputationsAttachment = options?.computationsAttachmentXhtml
    ? encodeInlineXbrlDocumentForCtSubmission(
        options.computationsAttachmentXhtml,
      )
    : undefined;
  const bodyXmlWithoutIrmark = renderCt600DraftBodyXml({
    draft,
    submissionReference: reference,
    encodedAccountsAttachment,
    encodedComputationsAttachment,
  });
  const irMark = computeCt600DraftIrmark(bodyXmlWithoutIrmark);
  const bodyXml = renderCt600DraftBodyXml({
    draft,
    submissionReference: reference,
    irMark,
    encodedAccountsAttachment,
    encodedComputationsAttachment,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${escapeXml(
    draft.filingReadiness.isReady
      ? `CT600 XML generated by Tamias for the supported filing-ready path: ${draft.filingReadiness.supportedPath}.`
      : "Draft CT600 XML generated by Tamias. Do not submit until the filing-readiness blockers are cleared.",
  )} -->
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <EnvelopeVersion>2.0</EnvelopeVersion>
  <Header>
    <MessageDetails>
      <Class>HMRC-CT-CT600</Class>
      <Qualifier>request</Qualifier>
      <Function>submit</Function>
      <CorrelationID/>
      <Transformation>XML</Transformation>
      <GatewayTest>${environment === "test" ? "1" : "0"}</GatewayTest>
    </MessageDetails>
    <SenderDetails>
      <IDAuthentication>
        <SenderID>${escapeXml(senderId)}</SenderID>
        <Authentication>
          <Method>clear</Method>
          <Role>Principal</Role>
          <Value>${escapeXml(senderPassword)}</Value>
        </Authentication>
      </IDAuthentication>
    </SenderDetails>
  </Header>
  <GovTalkDetails>
    <Keys>
      <Key Type="UTR">${escapeXml(reference)}</Key>
    </Keys>
    <TargetDetails>
      <Organisation>HMRC</Organisation>
    </TargetDetails>
    <ChannelRouting>
      <Channel>
        <URI>${escapeXml(vendorId)}</URI>
        <Product>${escapeXml(productName)}</Product>
        <Version>${escapeXml(productVersion)}</Version>
      </Channel>
    </ChannelRouting>
  </GovTalkDetails>
${bodyXml}
</GovTalkMessage>`;
}

type InlineXbrlContext = {
  id: string;
  scheme: string;
  identifier: string;
  instant?: string;
  startDate?: string;
  endDate?: string;
  explicitMembers?: Array<{
    dimension: string;
    value: string;
  }>;
  typedMembers?: Array<{
    dimension: string;
    domainElement: string;
    value: string;
  }>;
};

function formatIxbrlAmount(amount: number) {
  return roundCurrency(amount).toFixed(2);
}

function resolveAccountsEntityIdentifier(draft: StatutoryAccountsDraft) {
  if (draft.companyNumber) {
    return {
      scheme: "http://www.companieshouse.gov.uk/",
      identifier: draft.companyNumber,
    };
  }

  return {
    scheme: "https://tamias.local/entity",
    identifier: draft.companyName.replaceAll(/\s+/g, "-").toLowerCase(),
  };
}

function resolveCtEntityIdentifier(draft: Ct600Draft) {
  if (draft.utr) {
    return {
      scheme: "http://www.hmrc.gov.uk/UTR/CT",
      identifier: draft.utr,
    };
  }

  if (draft.companyNumber) {
    return {
      scheme: "http://www.companieshouse.gov.uk/",
      identifier: draft.companyNumber,
    };
  }

  return {
    scheme: "https://tamias.local/entity",
    identifier: draft.companyName.replaceAll(/\s+/g, "-").toLowerCase(),
  };
}

function renderInlineXbrlContext(context: InlineXbrlContext) {
  const periodMarkup = context.instant
    ? `<xbrli:period><xbrli:instant>${escapeXml(context.instant)}</xbrli:instant></xbrli:period>`
    : `<xbrli:period><xbrli:startDate>${escapeXml(
        context.startDate ?? "",
      )}</xbrli:startDate><xbrli:endDate>${escapeXml(
        context.endDate ?? "",
      )}</xbrli:endDate></xbrli:period>`;
  const explicitMembersMarkup = (context.explicitMembers ?? [])
    .map(
      (member) =>
        `<xbrldi:explicitMember dimension="${escapeXml(
          member.dimension,
        )}">${escapeXml(member.value)}</xbrldi:explicitMember>`,
    )
    .join("");
  const typedMembersMarkup = (context.typedMembers ?? [])
    .map(
      (member) =>
        `<xbrldi:typedMember dimension="${escapeXml(
          member.dimension,
        )}"><${escapeXml(member.domainElement)}>${escapeXml(
          member.value,
        )}</${escapeXml(member.domainElement)}></xbrldi:typedMember>`,
    )
    .join("");
  const membersMarkup = `${typedMembersMarkup}${explicitMembersMarkup}`;
  const segmentMarkup = membersMarkup
    ? `<xbrli:segment>${membersMarkup}</xbrli:segment>`
    : "";

  return `<xbrli:context id="${escapeXml(context.id)}"><xbrli:entity><xbrli:identifier scheme="${escapeXml(
    context.scheme,
  )}">${escapeXml(context.identifier)}</xbrli:identifier>${segmentMarkup}</xbrli:entity>${periodMarkup}</xbrli:context>`;
}

function renderPlainRows(
  rows: Array<{
    label: string;
    value: string;
  }>,
) {
  return rows
    .map(
      (row) =>
        `<tr><td>${escapeXml(row.label)}</td><td class="amount">${escapeXml(
          row.value,
        )}</td></tr>`,
    )
    .join("");
}

function renderBulletList(items: string[]) {
  if (!items.length) {
    return "";
  }

  return `<ul>${items
    .map((item) => `<li>${escapeXml(item)}</li>`)
    .join("")}</ul>`;
}

function renderInlineXbrlUnit(id: string, measure: string) {
  return `<xbrli:unit id="${escapeXml(id)}"><xbrli:measure>${escapeXml(
    measure,
  )}</xbrli:measure></xbrli:unit>`;
}

function formatIxbrlWholeNumber(value: number) {
  return Math.round(value).toString();
}

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

export function renderAccountsAttachmentIxbrl(draft: StatutoryAccountsDraft) {
  const entity = resolveAccountsEntityIdentifier(draft);
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
  const formattedPeriodStart = formatDraftDate(draft.periodStart);
  const formattedPeriodEnd = formatDraftDate(draft.periodEnd);
  const formattedApprovalDate = draft.approvalDate
    ? formatDraftDate(draft.approvalDate)
    : null;
  const registeredNumberText = draft.companyNumber
    ? `Registered Number ${draft.companyNumber}`
    : "Registered Number unavailable";
  const coverTitle = isDormant
    ? "Dormant accounts"
    : "Unaudited statutory accounts";
  const statementsMarkup = [
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
  const readyBanner = draft.filingReadiness.isReady
    ? `<div class="banner banner-ready"><strong>Filing-ready accounts attachment.</strong> This document contains the statutory disclosures and taxonomy-backed facts required for the supported small-company filing path.</div>`
    : `<div class="banner banner-draft"><strong>Draft review attachment.</strong> Clear the filing-readiness blockers before treating this accounts attachment as filing-ready.</div>`;

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
    <title>${escapeXml(draft.companyName)} accounts attachment</title>
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
    <div class="hidden">
      <ix:header>
        <ix:references>
          <link:schemaRef xlink:type="simple" xlink:href="${escapeXml(
            HMRC_ACCEPTED_FRC_2025_FRS_102_ENTRY_POINT,
          )}" />
        </ix:references>
        <ix:resources>
          ${renderInlineXbrlContext({
            id: durationContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            startDate: draft.periodStart,
            endDate: draft.periodEnd,
          })}
          ${renderInlineXbrlContext({
            id: instantContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            instant: draft.periodEnd,
          })}
          ${renderInlineXbrlContext({
            id: accountsStatusContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            startDate: draft.periodStart,
            endDate: draft.periodEnd,
            explicitMembers: [
              {
                dimension: "bus:AccountsStatusDimension",
                value: "bus:AuditExempt-NoAccountantsReport",
              },
            ],
          })}
          ${renderInlineXbrlContext({
            id: accountsTypeContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            startDate: draft.periodStart,
            endDate: draft.periodEnd,
            explicitMembers: [
              {
                dimension: "bus:AccountsTypeDimension",
                value: "bus:FullAccounts",
              },
            ],
          })}
          ${renderInlineXbrlContext({
            id: accountingStandardsContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            startDate: draft.periodStart,
            endDate: draft.periodEnd,
            explicitMembers: [
              {
                dimension: "bus:AccountingStandardsDimension",
                value: "bus:SmallEntities",
              },
            ],
          })}
          ${directorContexts
            .map((context) =>
              renderInlineXbrlContext({
                id: context.id,
                scheme: entity.scheme,
                identifier: entity.identifier,
                startDate: draft.periodStart,
                endDate: draft.periodEnd,
                explicitMembers: context.explicitMembers,
              }),
            )
            .join("")}
          ${renderInlineXbrlUnit(
            monetaryUnitId,
            `iso4217:${draft.currency.toUpperCase()}`,
          )}
          ${renderInlineXbrlUnit(pureUnitId, "xbrli:pure")}
          ${renderInlineXbrlUnit(sharesUnitId, "xbrli:shares")}
        </ix:resources>
      </ix:header>
    </div>
    <div class="hidden">
      <ix:nonNumeric name="bus:AccountingStandardsApplied" contextRef="${accountingStandardsContextId}"></ix:nonNumeric>
      <ix:nonNumeric name="bus:AccountsStatusAuditedOrUnaudited" contextRef="${accountsStatusContextId}"></ix:nonNumeric>
      <ix:nonNumeric name="bus:AccountsType" contextRef="${accountsTypeContextId}"></ix:nonNumeric>
      <ix:nonNumeric name="bus:EntityTradingStatus" contextRef="${durationContextId}"></ix:nonNumeric>
      <ix:nonNumeric name="bus:StartDateForPeriodCoveredByReport" contextRef="${instantContextId}">${escapeXml(
        draft.periodStart,
      )}</ix:nonNumeric>
      <ix:nonNumeric name="bus:EndDateForPeriodCoveredByReport" contextRef="${instantContextId}">${escapeXml(
        draft.periodEnd,
      )}</ix:nonNumeric>
      <ix:nonNumeric name="bus:BalanceSheetDate" contextRef="${instantContextId}">${escapeXml(
        draft.periodEnd,
      )}</ix:nonNumeric>
      <ix:nonNumeric name="bus:EntityDormantTruefalse" contextRef="${durationContextId}">${String(
        isDormant,
      )}</ix:nonNumeric>
      ${
        draft.approvalDate
          ? `<ix:nonNumeric name="core:DateAuthorisationFinancialStatementsForIssue" contextRef="${instantContextId}">${escapeXml(
              draft.approvalDate,
            )}</ix:nonNumeric>`
          : ""
      }
    </div>
    <div class="titlepage accountspage pagebreak">
      ${
        draft.companyNumber
          ? `<p>Registered Number <ix:nonNumeric name="bus:UKCompaniesHouseRegisteredNumber" contextRef="${durationContextId}">${escapeXml(
              draft.companyNumber,
            )}</ix:nonNumeric></p>`
          : `<p>${escapeXml(registeredNumberText)}</p>`
      }
      <p><ix:nonNumeric name="bus:EntityCurrentLegalOrRegisteredName" contextRef="${durationContextId}">${escapeXml(
        draft.companyName,
      )}</ix:nonNumeric></p>
      <p>${escapeXml(coverTitle)}</p>
      <p>For the year ended ${escapeXml(formattedPeriodEnd)}</p>
      <p class="dotted-line"></p>
      <p class="title-subtitle">
        Prepared for the supported small-company filing path in ${escapeXml(
          draft.accountingBasis,
        )}.
      </p>
    </div>

    <div class="accountspage pagebreak">
      <div class="accountsheader">
        <h2>
          <span class="left">${escapeXml(draft.companyName)}</span>
          <span class="right">${escapeXml(registeredNumberText)}</span>
        </h2>
      </div>

      <div class="section">
        <h3 class="middle">Company information</h3>
        <p class="dotted-line"></p>
        ${readyBanner}
        <p class="summary">
          Statutory accounts for the period ${escapeXml(formattedPeriodStart)} to
          ${escapeXml(formattedPeriodEnd)}.
        </p>
        <table class="detail-table">
          <tbody>
            <tr>
              <th>Balance sheet date</th>
              <td>${escapeXml(formattedPeriodEnd)}</td>
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
              <td>${escapeXml(isDormant ? "Yes" : "No")}</td>
            </tr>
            ${
              draft.principalActivity
                ? `<tr>
              <th>Principal activity</th>
              <td><ix:nonNumeric name="bus:DescriptionPrincipalActivities" contextRef="${durationContextId}">${escapeXml(
                draft.principalActivity,
              )}</ix:nonNumeric></td>
            </tr>`
                : ""
            }
            ${
              directorContexts.length
                ? `<tr>
              <th>Directors</th>
              <td>${directorContexts
                .map(
                  (context) =>
                    `<div><ix:nonNumeric name="bus:NameEntityOfficer" contextRef="${context.id}">${escapeXml(
                      context.name,
                    )}</ix:nonNumeric></div>`,
                )
                .join("")}</td>
            </tr>`
                : ""
            }
          </tbody>
        </table>
      </div>
    </div>

    <div class="accountspage pagebreak">
      <div class="accountsheader">
        <h2>
          <span class="left">${escapeXml(draft.companyName)}</span>
          <span class="right">${escapeXml(registeredNumberText)}</span>
        </h2>
      </div>

      <div id="balancesheet" class="section">
        <h3 class="middle">Balance Sheet as at ${escapeXml(
          formattedPeriodEnd,
        )}</h3>
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
              <td class="amount"><ix:nonFraction name="core:TotalAssets" contextRef="${instantContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                draft.statementOfFinancialPosition.assets,
              )}</ix:nonFraction></td>
            </tr>
            <tr>
              <th>Creditors</th>
              <td class="amount"><ix:nonFraction name="core:Creditors" contextRef="${instantContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                draft.statementOfFinancialPosition.liabilities,
              )}</ix:nonFraction></td>
            </tr>
            <tr>
              <th>Total assets less current liabilities</th>
              <td class="amount"><ix:nonFraction name="core:TotalAssetsLessCurrentLiabilities" contextRef="${instantContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                totalAssetsLessCurrentLiabilities,
              )}</ix:nonFraction></td>
            </tr>
            <tr class="total">
              <th>Net assets or liabilities</th>
              <td class="amount"><ix:nonFraction name="core:NetAssetsLiabilities" contextRef="${instantContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                draft.statementOfFinancialPosition.netAssets,
              )}</ix:nonFraction></td>
            </tr>
            ${
              Math.abs(currentTaxForPeriod) > 0.009
                ? `<tr>
              <th>Corporation tax payable</th>
              <td class="amount"><ix:nonFraction name="core:CorporationTaxPayable" contextRef="${instantContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                currentTaxForPeriod,
              )}</ix:nonFraction></td>
            </tr>`
                : ""
            }
          </tbody>
        </table>
      </div>

      ${
        statementsMarkup
          ? `<div id="statements" class="section">
        <h3>Statements</h3>
        <ol class="lower-alpha">
          ${statementsMarkup}
        </ol>
      </div>`
          : ""
      }

      ${
        draft.signingDirectorName && draft.approvalDate
          ? `<div id="approval" class="section approval">
        <h3>Approval</h3>
        <p><ix:nonNumeric name="core:DescriptionBodyAuthorisingFinancialStatements" contextRef="${durationContextId}">Board of directors</ix:nonNumeric> approved these financial statements on ${escapeXml(
          formattedApprovalDate ?? "",
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
      </div>`
          : ""
      }
    </div>

    <div class="accountspage">
      <div class="accountsheader">
        <h2>
          <span class="left">${escapeXml(draft.companyName)}</span>
          <span class="right">${escapeXml(registeredNumberText)}</span>
        </h2>
      </div>

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
                <td class="amount"><ix:nonFraction name="core:ProfitLossBeforeTax" contextRef="${durationContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                  profitBeforeTax,
                )}</ix:nonFraction></td>
              </tr>
              <tr>
                <td>Current tax for period</td>
                <td class="amount"><ix:nonFraction name="core:CurrentTaxForPeriod" contextRef="${durationContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                  currentTaxForPeriod,
                )}</ix:nonFraction></td>
              </tr>
              <tr>
                <td>Profit or loss</td>
                <td class="amount"><ix:nonFraction name="core:ProfitLoss" contextRef="${durationContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                  profitAfterTax,
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
                <td class="amount"><ix:nonFraction name="core:NumberOrdinarySharesInIssueExcludingTreasuryOwnShares" contextRef="${instantContextId}" unitRef="${sharesUnitId}" decimals="0">${formatIxbrlWholeNumber(
                  draft.ordinaryShareCount,
                )}</ix:nonFraction></td>
              </tr>
              <tr>
                <td>Shares issued and fully paid</td>
                <td class="amount"><ix:nonFraction name="core:NumberSharesIssuedFullyPaid" contextRef="${instantContextId}" unitRef="${sharesUnitId}" decimals="0">${formatIxbrlWholeNumber(
                  draft.ordinaryShareCount,
                )}</ix:nonFraction></td>
              </tr>`
                  : ""
              }
              ${
                draft.statementOfFinancialPosition.shareCapital
                  ? `<tr>
                <td>Nominal value of allotted share capital</td>
                <td class="amount"><ix:nonFraction name="core:NominalValueAllottedShareCapital" contextRef="${durationContextId}" unitRef="${monetaryUnitId}" decimals="2">${formatIxbrlAmount(
                  draft.statementOfFinancialPosition.shareCapital,
                )}</ix:nonFraction></td>
              </tr>`
                  : ""
              }
              ${
                draft.averageEmployeeCount != null
                  ? `<tr>
                <td>Average number of employees</td>
                <td class="amount"><ix:nonFraction name="core:AverageNumberEmployeesDuringPeriod" contextRef="${durationContextId}" unitRef="${pureUnitId}" decimals="0">${formatIxbrlWholeNumber(
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

        ${
          draft.filingReadiness.isReady
            ? ""
            : `<div class="section">
          <h2>Review notes</h2>
          <div class="review-columns">
            <div>
              <strong>Review items</strong>
              ${renderBulletList(draft.reviewItems)}
            </div>
            <div>
              <strong>Limitations</strong>
              ${renderBulletList(draft.limitations)}
            </div>
          </div>
        </div>`
        }
      </div>
    </div>
  </body>
</html>`;
}

export function renderComputationsAttachmentIxbrl(draft: Ct600Draft) {
  const entity = resolveCtEntityIdentifier(draft);
  const instantContextId = "ct-context";
  const durationSummaryContextId = "ct-context-summary";
  const durationTradeDetailContextId = "ct-context-trade-detail";
  const unitId = "unit";
  const pureUnitId = "pure-unit";
  const tradeBusinessName =
    draft.companyName.replace(/\s+/g, " ").trim() || "Main trade";
  const periodUsesSmallProfitsRules =
    parseISO(draft.periodEnd).getTime() >=
    parseISO(SMALL_PROFITS_RATE_START).getTime();
  const rateBreakdownRows = draft.financialYearBreakdown.map(
    (financialYear) => ({
      label: `FY ${financialYear.financialYear} · ${humanizeToken(
        financialYear.chargeType,
      )}`,
      value: `${formatDraftAmount(
        financialYear.netCorporationTax,
        draft.currency,
      )} on profits ${formatDraftAmount(
        financialYear.chargeableProfits,
        draft.currency,
      )}${
        financialYear.lowerLimit != null && financialYear.upperLimit != null
          ? ` · limits ${formatDraftAmount(
              financialYear.lowerLimit,
              draft.currency,
            )} to ${formatDraftAmount(
              financialYear.upperLimit,
              draft.currency,
            )}`
          : ""
      }`,
    }),
  );
  const readyBanner = draft.filingReadiness.isReady
    ? `<div class="banner banner-ready"><strong>Filing-ready computation attachment.</strong> This document contains the structured HMRC CT computation facts for the supported small-company filing path.</div>`
    : `<div class="banner banner-draft"><strong>Draft review attachment.</strong> Clear the filing-readiness blockers before treating this computation attachment as filing-ready.</div>`;

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
    <div style="display:none">
      <ix:header>
        <ix:references>
          <link:schemaRef xlink:type="simple" xlink:href="${escapeXml(
            HMRC_CT_COMPUTATIONS_2024_ENTRY_POINT,
          )}" />
        </ix:references>
        <ix:resources>
          ${renderInlineXbrlContext({
            id: instantContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            instant: draft.periodEnd,
            explicitMembers: [
              {
                dimension: "ct-comp:BusinessTypeDimension",
                value: "ct-comp:Company",
              },
              {
                dimension: "ct-comp:DetailedAnalysisDimension",
                value: "ct-comp:Item1",
              },
            ],
          })}
          ${renderInlineXbrlContext({
            id: durationSummaryContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            startDate: draft.periodStart,
            endDate: draft.periodEnd,
            explicitMembers: [
              {
                dimension: "ct-comp:BusinessTypeDimension",
                value: "ct-comp:Company",
              },
              {
                dimension: "ct-comp:DetailedAnalysisDimension",
                value: "ct-comp:Item1",
              },
              {
                dimension: "ct-comp:TerritoryDimension",
                value: "ct-comp:Overseas",
              },
            ],
          })}
          ${renderInlineXbrlContext({
            id: durationTradeDetailContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            startDate: draft.periodStart,
            endDate: draft.periodEnd,
            explicitMembers: [
              {
                dimension: "ct-comp:BusinessTypeDimension",
                value: "ct-comp:Trade",
              },
              {
                dimension: "ct-comp:DetailedAnalysisDimension",
                value: "ct-comp:Item1",
              },
              {
                dimension: "ct-comp:LossReformDimension",
                value: "ct-comp:Post-lossReform",
              },
              {
                dimension: "ct-comp:TerritoryDimension",
                value: "ct-comp:UK",
              },
            ],
            typedMembers: [
              {
                dimension: "ct-comp:BusinessNameDimension",
                domainElement: "ct-comp:BusinessNameDomain",
                value: tradeBusinessName,
              },
            ],
          })}
          <xbrli:unit id="${unitId}"><xbrli:measure>iso4217:${escapeXml(
            draft.currency.toUpperCase(),
          )}</xbrli:measure></xbrli:unit>
          <xbrli:unit id="${pureUnitId}"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>
        </ix:resources>
      </ix:header>
    </div>
    <h1><ix:nonNumeric name="ct-comp:CompanyName" contextRef="${instantContextId}">${escapeXml(
      draft.companyName,
    )}</ix:nonNumeric></h1>
    <p class="muted">
      iXBRL corporation tax computation attachment for the period
      <ix:nonNumeric name="ct-comp:PeriodOfAccountStartDate" contextRef="${instantContextId}">${escapeXml(
        draft.periodStart,
      )}</ix:nonNumeric>
      to
      <ix:nonNumeric name="ct-comp:PeriodOfAccountEndDate" contextRef="${instantContextId}">${escapeXml(
        draft.periodEnd,
      )}</ix:nonNumeric>.
    </p>
    ${readyBanner}
    <div class="meta">
      <div class="meta-card"><span class="meta-label">Return period start</span><ix:nonNumeric name="ct-comp:StartOfPeriodCoveredByReturn" contextRef="${instantContextId}">${escapeXml(
        draft.periodStart,
      )}</ix:nonNumeric></div>
      <div class="meta-card"><span class="meta-label">Return period end</span><ix:nonNumeric name="ct-comp:EndOfPeriodCoveredByReturn" contextRef="${instantContextId}">${escapeXml(
        draft.periodEnd,
      )}</ix:nonNumeric></div>
      <div class="meta-card"><span class="meta-label">UTR</span>${escapeXml(
        draft.utr ?? "Missing",
      )}</div>
      <div class="meta-card"><span class="meta-label">Financial year</span>${draft.financialYear}</div>
    </div>

    <div class="section">
      <h2>Tax computation summary</h2>
      <table>
        <thead><tr><th>Line</th><th class="amount">Tagged value</th></tr></thead>
        <tbody>
          <tr><td>Profit or loss per accounts</td><td class="amount"><ix:nonFraction name="ct-comp:ProfitLossPerAccounts" unitRef="${unitId}" contextRef="${durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.profitLossPerAccounts,
          )}</ix:nonFraction></td></tr>
          <tr><td>Depreciation</td><td class="amount"><ix:nonFraction name="ct-comp:AdjustmentsDepreciation" unitRef="${unitId}" contextRef="${durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.depreciationAmortisationAdjustments,
          )}</ix:nonFraction></td></tr>
          <tr><td>Depreciation, amortisation and loss or profit on sale</td><td class="amount"><ix:nonFraction name="ct-comp:AdjustmentsDepreciationAmortisationAndLossOrProfitOnSale" unitRef="${unitId}" contextRef="${durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.depreciationAmortisationAdjustments,
          )}</ix:nonFraction></td></tr>
          <tr><td>Capital allowances balancing charges</td><td class="amount"><ix:nonFraction name="ct-comp:CapitalAllowancesBalancingCharges" unitRef="${unitId}" contextRef="${durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.capitalAllowancesBalancingCharges,
          )}</ix:nonFraction></td></tr>
          <tr><td>Net trading profits</td><td class="amount"><ix:nonFraction name="ct-comp:NetTradingProfits" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.netTradingProfits,
          )}</ix:nonFraction></td></tr>
          <tr><td>Total capital allowances</td><td class="amount"><ix:nonFraction name="ct-comp:TotalCapitalAllowances" unitRef="${unitId}" contextRef="${durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.totalCapitalAllowances,
          )}</ix:nonFraction></td></tr>
          <tr><td>Profits before qualifying donations and group relief</td><td class="amount"><ix:nonFraction name="ct-comp:ProfitsBeforeChargesAndGroupRelief" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.profitsBeforeChargesAndGroupRelief,
          )}</ix:nonFraction></td></tr>
          <tr><td>Qualifying UK donations</td><td class="amount"><ix:nonFraction name="ct-comp:QualifyingUKDonations" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.qualifyingDonations,
          )}</ix:nonFraction></td></tr>
          <tr><td>Qualifying donations</td><td class="amount"><ix:nonFraction name="ct-comp:QualifyingDonations" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.qualifyingDonations,
          )}</ix:nonFraction></td></tr>
          <tr><td>Trading losses brought forward</td><td class="amount"><ix:nonFraction name="ct-comp:TradingLossesBroughtForward" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.lossesBroughtForward,
          )}</ix:nonFraction></td></tr>
          <tr><td>Trading losses brought forward claimed against trading profits</td><td class="amount"><ix:nonFraction name="ct-comp:TradingLossesBroughtForwardValueClaimedAgainstTradingProfits" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.lossesBroughtForward,
          )}</ix:nonFraction></td></tr>
          <tr><td>Group relief claimed</td><td class="amount"><ix:nonFraction name="ct-comp:GroupReliefClaimed" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.groupReliefClaimed,
          )}</ix:nonFraction></td></tr>
          <tr><td>Total profits chargeable to corporation tax</td><td class="amount"><ix:nonFraction name="ct-comp:TotalProfitsChargeableToCorporationTax" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.computationBreakdown.totalProfitsChargeableToCorporationTax,
          )}</ix:nonFraction></td></tr>
          ${
            periodUsesSmallProfitsRules
              ? `<tr><td>Exempt ABGH distributions</td><td class="amount"><ix:nonFraction name="ct-comp:ExemptABGHDistributions" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
                  draft.exemptDistributions,
                )}</ix:nonFraction></td></tr>`
              : ""
          }
          ${
            periodUsesSmallProfitsRules &&
            draft.associatedCompaniesMode === "this_period"
              ? `<tr><td>Associated companies in this period</td><td class="amount"><ix:nonFraction name="ct-comp:NumberOfAssociatedCompaniesInThisPeriod" unitRef="${pureUnitId}" contextRef="${durationSummaryContextId}" decimals="0">${formatIxbrlWholeNumber(
                  draft.associatedCompaniesThisPeriod ?? 0,
                )}</ix:nonFraction></td></tr>`
              : ""
          }
          ${
            periodUsesSmallProfitsRules &&
            draft.associatedCompaniesMode === "financial_years"
              ? `<tr><td>Associated companies in FY ${draft.financialYear}</td><td class="amount"><ix:nonFraction name="ct-comp:NumberOfAssociatedCompaniesInFY1" unitRef="${pureUnitId}" contextRef="${durationSummaryContextId}" decimals="0">${formatIxbrlWholeNumber(
                  draft.associatedCompaniesFirstYear ?? 0,
                )}</ix:nonFraction></td></tr>
                 <tr><td>Associated companies in FY ${draft.financialYear + 1}</td><td class="amount"><ix:nonFraction name="ct-comp:NumberOfAssociatedCompaniesInFY2" unitRef="${pureUnitId}" contextRef="${durationSummaryContextId}" decimals="0">${formatIxbrlWholeNumber(
                   draft.associatedCompaniesSecondYear ?? 0,
                 )}</ix:nonFraction></td></tr>`
              : ""
          }
          <tr><td>Corporation tax chargeable</td><td class="amount"><ix:nonFraction name="ct-comp:CorporationTaxChargeable" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.corporationTax,
          )}</ix:nonFraction></td></tr>
          ${
            draft.marginalRelief > 0
              ? `<tr><td>Marginal relief</td><td class="amount"><ix:nonFraction name="ct-comp:MarginalRateReliefForRingFenceTradesPayable" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
                  draft.marginalRelief,
                )}</ix:nonFraction></td></tr>`
              : ""
          }
          <tr><td>Corporation tax chargeable, payable</td><td class="amount"><ix:nonFraction name="ct-comp:CorporationTaxChargeablePayable" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.netCorporationTaxChargeable,
          )}</ix:nonFraction></td></tr>
          <tr><td>Net corporation tax payable</td><td class="amount"><ix:nonFraction name="ct-comp:NetCorporationTaxPayable" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.taxPayable,
          )}</ix:nonFraction></td></tr>
          <tr><td>Tax chargeable</td><td class="amount"><ix:nonFraction name="ct-comp:TaxChargeable" unitRef="${unitId}" contextRef="${durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            draft.taxChargeable,
          )}</ix:nonFraction></td></tr>
        </tbody>
      </table>
    </div>

    ${
      rateBreakdownRows.length
        ? `<div class="section">
      <h2>Corporation tax rate breakdown</h2>
      <table>
        <thead><tr><th>Line</th><th class="amount">Amount</th></tr></thead>
        <tbody>${renderPlainRows(rateBreakdownRows)}</tbody>
      </table>
    </div>`
        : ""
    }

    <div class="section">
      <h2>Adjustment category mapping</h2>
      <table>
        <thead><tr><th>Line</th><th class="amount">Amount</th></tr></thead>
        <tbody>${renderPlainRows([
          {
            label: "Depreciation and amortisation adjustments",
            value: formatDraftAmount(
              draft.computationBreakdown.depreciationAmortisationAdjustments,
              draft.currency,
            ),
          },
          {
            label: "Capital allowances balancing charges",
            value: formatDraftAmount(
              draft.computationBreakdown.capitalAllowancesBalancingCharges,
              draft.currency,
            ),
          },
          {
            label: "Capital allowances",
            value: formatDraftAmount(
              draft.computationBreakdown.totalCapitalAllowances,
              draft.currency,
            ),
          },
          {
            label: "Qualifying donations",
            value: formatDraftAmount(
              draft.computationBreakdown.qualifyingDonations,
              draft.currency,
            ),
          },
          {
            label: "Losses brought forward claimed",
            value: formatDraftAmount(
              draft.computationBreakdown.lossesBroughtForward,
              draft.currency,
            ),
          },
          {
            label: "Group relief claimed",
            value: formatDraftAmount(
              draft.computationBreakdown.groupReliefClaimed,
              draft.currency,
            ),
          },
        ])}</tbody>
      </table>
    </div>

    ${
      draft.filingReadiness.isReady
        ? ""
        : `<div class="section">
      <h2>Review items</h2>
      ${renderBulletList(draft.reviewItems)}
    </div>

    <div class="section">
      <h2>Limitations</h2>
      ${renderBulletList(draft.limitations)}
    </div>`
    }
  </body>
</html>`;
}

export function renderStatutoryAccountsDraftHtml(
  draft: StatutoryAccountsDraft,
) {
  const renderMoneyTable = (lines: Array<{ label: string; amount: number }>) =>
    lines
      .map(
        (line) => `
          <tr>
            <td>${escapeHtml(line.label)}</td>
            <td class="amount">${escapeHtml(
              formatDraftAmount(line.amount, draft.currency),
            )}</td>
          </tr>`,
      )
      .join("");

  const reviewItems = draft.reviewItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const limitations = draft.limitations
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
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
        draft.filingReadiness.isReady
          ? "Supported-path filing ready."
          : "Draft only.",
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
