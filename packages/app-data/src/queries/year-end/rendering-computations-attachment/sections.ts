import { HMRC_CT_COMPUTATIONS_2024_ENTRY_POINT } from "../constants";
import {
  escapeXml,
  formatDraftAmount,
} from "../formatting";
import {
  formatIxbrlAmount,
  formatIxbrlWholeNumber,
  renderBulletList,
  renderInlineXbrlContext,
  renderPlainRows,
} from "../rendering-ixbrl";
import type { Ct600Draft } from "../types";
import type { ComputationsAttachmentRenderData } from "./types";

function renderAssociatedCompaniesRows(data: ComputationsAttachmentRenderData) {
  if (!data.periodUsesSmallProfitsRules) {
    return "";
  }

  if (data.draft.associatedCompaniesMode === "this_period") {
    return `<tr><td>Associated companies in this period</td><td class="amount"><ix:nonFraction name="ct-comp:NumberOfAssociatedCompaniesInThisPeriod" unitRef="${data.pureUnitId}" contextRef="${data.durationSummaryContextId}" decimals="0">${formatIxbrlWholeNumber(
      data.draft.associatedCompaniesThisPeriod ?? 0,
    )}</ix:nonFraction></td></tr>`;
  }

  if (data.draft.associatedCompaniesMode === "financial_years") {
    return `<tr><td>Associated companies in FY ${data.draft.financialYear}</td><td class="amount"><ix:nonFraction name="ct-comp:NumberOfAssociatedCompaniesInFY1" unitRef="${data.pureUnitId}" contextRef="${data.durationSummaryContextId}" decimals="0">${formatIxbrlWholeNumber(
      data.draft.associatedCompaniesFirstYear ?? 0,
    )}</ix:nonFraction></td></tr>
                 <tr><td>Associated companies in FY ${data.draft.financialYear + 1}</td><td class="amount"><ix:nonFraction name="ct-comp:NumberOfAssociatedCompaniesInFY2" unitRef="${data.pureUnitId}" contextRef="${data.durationSummaryContextId}" decimals="0">${formatIxbrlWholeNumber(
                   data.draft.associatedCompaniesSecondYear ?? 0,
                 )}</ix:nonFraction></td></tr>`;
  }

  return "";
}

export function renderComputationsAttachmentHeader(
  data: ComputationsAttachmentRenderData,
) {
  return `<div style="display:none">
      <ix:header>
        <ix:references>
          <link:schemaRef xlink:type="simple" xlink:href="${escapeXml(
            HMRC_CT_COMPUTATIONS_2024_ENTRY_POINT,
          )}" />
        </ix:references>
        <ix:resources>
          ${renderInlineXbrlContext({
            id: data.instantContextId,
            scheme: data.entity.scheme,
            identifier: data.entity.identifier,
            instant: data.draft.periodEnd,
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
            id: data.durationSummaryContextId,
            scheme: data.entity.scheme,
            identifier: data.entity.identifier,
            startDate: data.draft.periodStart,
            endDate: data.draft.periodEnd,
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
            id: data.durationTradeDetailContextId,
            scheme: data.entity.scheme,
            identifier: data.entity.identifier,
            startDate: data.draft.periodStart,
            endDate: data.draft.periodEnd,
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
                value: data.tradeBusinessName,
              },
            ],
          })}
          <xbrli:unit id="${data.unitId}"><xbrli:measure>iso4217:${escapeXml(
            data.draft.currency.toUpperCase(),
          )}</xbrli:measure></xbrli:unit>
          <xbrli:unit id="${data.pureUnitId}"><xbrli:measure>xbrli:pure</xbrli:measure></xbrli:unit>
        </ix:resources>
      </ix:header>
    </div>`;
}

export function renderTaxComputationSummary(
  data: ComputationsAttachmentRenderData,
) {
  return `<div class="section">
      <h2>Tax computation summary</h2>
      <table>
        <thead><tr><th>Line</th><th class="amount">Tagged value</th></tr></thead>
        <tbody>
          <tr><td>Profit or loss per accounts</td><td class="amount"><ix:nonFraction name="ct-comp:ProfitLossPerAccounts" unitRef="${data.unitId}" contextRef="${data.durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.profitLossPerAccounts,
          )}</ix:nonFraction></td></tr>
          <tr><td>Depreciation</td><td class="amount"><ix:nonFraction name="ct-comp:AdjustmentsDepreciation" unitRef="${data.unitId}" contextRef="${data.durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.depreciationAmortisationAdjustments,
          )}</ix:nonFraction></td></tr>
          <tr><td>Depreciation, amortisation and loss or profit on sale</td><td class="amount"><ix:nonFraction name="ct-comp:AdjustmentsDepreciationAmortisationAndLossOrProfitOnSale" unitRef="${data.unitId}" contextRef="${data.durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.depreciationAmortisationAdjustments,
          )}</ix:nonFraction></td></tr>
          <tr><td>Capital allowances balancing charges</td><td class="amount"><ix:nonFraction name="ct-comp:CapitalAllowancesBalancingCharges" unitRef="${data.unitId}" contextRef="${data.durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.capitalAllowancesBalancingCharges,
          )}</ix:nonFraction></td></tr>
          <tr><td>Net trading profits</td><td class="amount"><ix:nonFraction name="ct-comp:NetTradingProfits" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.netTradingProfits,
          )}</ix:nonFraction></td></tr>
          <tr><td>Total capital allowances</td><td class="amount"><ix:nonFraction name="ct-comp:TotalCapitalAllowances" unitRef="${data.unitId}" contextRef="${data.durationTradeDetailContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.totalCapitalAllowances,
          )}</ix:nonFraction></td></tr>
          <tr><td>Profits before qualifying donations and group relief</td><td class="amount"><ix:nonFraction name="ct-comp:ProfitsBeforeChargesAndGroupRelief" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.profitsBeforeChargesAndGroupRelief,
          )}</ix:nonFraction></td></tr>
          <tr><td>Qualifying UK donations</td><td class="amount"><ix:nonFraction name="ct-comp:QualifyingUKDonations" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.qualifyingDonations,
          )}</ix:nonFraction></td></tr>
          <tr><td>Qualifying donations</td><td class="amount"><ix:nonFraction name="ct-comp:QualifyingDonations" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.qualifyingDonations,
          )}</ix:nonFraction></td></tr>
          <tr><td>Trading losses brought forward</td><td class="amount"><ix:nonFraction name="ct-comp:TradingLossesBroughtForward" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.lossesBroughtForward,
          )}</ix:nonFraction></td></tr>
          <tr><td>Trading losses brought forward claimed against trading profits</td><td class="amount"><ix:nonFraction name="ct-comp:TradingLossesBroughtForwardValueClaimedAgainstTradingProfits" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.lossesBroughtForward,
          )}</ix:nonFraction></td></tr>
          <tr><td>Group relief claimed</td><td class="amount"><ix:nonFraction name="ct-comp:GroupReliefClaimed" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.groupReliefClaimed,
          )}</ix:nonFraction></td></tr>
          <tr><td>Total profits chargeable to corporation tax</td><td class="amount"><ix:nonFraction name="ct-comp:TotalProfitsChargeableToCorporationTax" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.computationBreakdown.totalProfitsChargeableToCorporationTax,
          )}</ix:nonFraction></td></tr>
          ${
            data.periodUsesSmallProfitsRules
              ? `<tr><td>Exempt ABGH distributions</td><td class="amount"><ix:nonFraction name="ct-comp:ExemptABGHDistributions" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
                  data.draft.exemptDistributions,
                )}</ix:nonFraction></td></tr>`
              : ""
          }
          ${renderAssociatedCompaniesRows(data)}
          <tr><td>Corporation tax chargeable</td><td class="amount"><ix:nonFraction name="ct-comp:CorporationTaxChargeable" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.corporationTax,
          )}</ix:nonFraction></td></tr>
          ${
            data.draft.marginalRelief > 0
              ? `<tr><td>Marginal relief</td><td class="amount"><ix:nonFraction name="ct-comp:MarginalRateReliefForRingFenceTradesPayable" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
                  data.draft.marginalRelief,
                )}</ix:nonFraction></td></tr>`
              : ""
          }
          <tr><td>Corporation tax chargeable, payable</td><td class="amount"><ix:nonFraction name="ct-comp:CorporationTaxChargeablePayable" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.netCorporationTaxChargeable,
          )}</ix:nonFraction></td></tr>
          <tr><td>Net corporation tax payable</td><td class="amount"><ix:nonFraction name="ct-comp:NetCorporationTaxPayable" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.taxPayable,
          )}</ix:nonFraction></td></tr>
          <tr><td>Tax chargeable</td><td class="amount"><ix:nonFraction name="ct-comp:TaxChargeable" unitRef="${data.unitId}" contextRef="${data.durationSummaryContextId}" decimals="2">${formatIxbrlAmount(
            data.draft.taxChargeable,
          )}</ix:nonFraction></td></tr>
        </tbody>
      </table>
    </div>`;
}

export function renderRateBreakdownSection(
  data: ComputationsAttachmentRenderData,
) {
  if (!data.rateBreakdownRows.length) {
    return "";
  }

  return `<div class="section">
      <h2>Corporation tax rate breakdown</h2>
      <table>
        <thead><tr><th>Line</th><th class="amount">Amount</th></tr></thead>
        <tbody>${renderPlainRows(data.rateBreakdownRows)}</tbody>
      </table>
    </div>`;
}

export function renderAdjustmentMappingSection(
  draft: Ct600Draft,
) {
  return `<div class="section">
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
    </div>`;
}

export function renderReviewSections(draft: Ct600Draft) {
  if (draft.filingReadiness.isReady) {
    return "";
  }

  return `<div class="section">
      <h2>Review items</h2>
      ${renderBulletList(draft.reviewItems)}
    </div>

    <div class="section">
      <h2>Limitations</h2>
      ${renderBulletList(draft.limitations)}
    </div>`;
}
