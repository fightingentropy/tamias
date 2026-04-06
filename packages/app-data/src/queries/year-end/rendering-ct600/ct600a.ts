import { escapeXml } from "../formatting";
import type { Ct600Draft } from "../types";
import { formatMoney } from "./shared";

type Ct600aLoan = {
  name: string;
  amountOfLoan: number;
};

type Ct600aReliefLoan = {
  name: string;
  amountRepaid?: number | null;
  amountReleasedOrWrittenOff?: number | null;
  date: string;
};

type Ct600aLoansInformation = {
  loans: Ct600aLoan[];
  totalLoans: number;
  taxChargeable: number;
};

type Ct600aReliefSection = {
  loans: Ct600aReliefLoan[];
  totalAmountRepaid?: number | null;
  totalAmountReleasedOrWritten?: number | null;
  totalLoans: number;
  reliefDue: number;
};

function renderOptionalMoneyElement(elementName: string, value: number | null | undefined) {
  return value != null ? `<${elementName}>${formatMoney(value)}</${elementName}>` : "";
}

function renderLoansInformationXml(section: Ct600aLoansInformation) {
  return `<LoansInformation>${section.loans
    .map(
      (loan) =>
        `<Loan><Name>${escapeXml(loan.name)}</Name><AmountOfLoan>${formatMoney(
          loan.amountOfLoan,
        )}</AmountOfLoan></Loan>`,
    )
    .join("")}<TotalLoans>${formatMoney(
    section.totalLoans,
  )}</TotalLoans><TaxChargeable>${formatMoney(
    section.taxChargeable,
  )}</TaxChargeable></LoansInformation>`;
}

function renderReliefSectionXml(
  elementName: "ReliefEarlierThan" | "LoanLaterReliefNow",
  section: Ct600aReliefSection,
) {
  return `<${elementName}>${section.loans
    .map(
      (loan) =>
        `<Loan><Name>${escapeXml(loan.name)}</Name>${renderOptionalMoneyElement(
          "AmountRepaid",
          loan.amountRepaid,
        )}${renderOptionalMoneyElement(
          "AmountReleasedOrWrittenOff",
          loan.amountReleasedOrWrittenOff,
        )}<Date>${escapeXml(loan.date)}</Date></Loan>`,
    )
    .join("")}${renderOptionalMoneyElement(
    "TotalAmountRepaid",
    section.totalAmountRepaid,
  )}${renderOptionalMoneyElement(
    "TotalAmountReleasedOrWritten",
    section.totalAmountReleasedOrWritten,
  )}<TotalLoans>${formatMoney(section.totalLoans)}</TotalLoans><ReliefDue>${formatMoney(
    section.reliefDue,
  )}</ReliefDue></${elementName}>`;
}

export function renderCt600aXml(draft: Ct600Draft) {
  const ct600aSupplement = draft.supplementaryPages.ct600a;

  if (!ct600aSupplement) {
    return "";
  }

  return `<LoansByCloseCompanies><BeforeEndPeriod>${
    ct600aSupplement.beforeEndPeriod ? "yes" : "no"
  }</BeforeEndPeriod>${
    ct600aSupplement.loansInformation
      ? renderLoansInformationXml(ct600aSupplement.loansInformation)
      : ""
  }${
    ct600aSupplement.reliefEarlierThan
      ? renderReliefSectionXml("ReliefEarlierThan", ct600aSupplement.reliefEarlierThan)
      : ""
  }${
    ct600aSupplement.loanLaterReliefNow
      ? renderReliefSectionXml("LoanLaterReliefNow", ct600aSupplement.loanLaterReliefNow)
      : ""
  }${renderOptionalMoneyElement(
    "TotalLoansOutstanding",
    ct600aSupplement.totalLoansOutstanding,
  )}<TaxPayable>${formatMoney(ct600aSupplement.taxPayable)}</TaxPayable></LoansByCloseCompanies>`;
}
