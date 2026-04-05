import { parseISO } from "date-fns";
import { SMALL_PROFITS_RATE_START } from "../constants";
import { formatDraftAmount, humanizeToken } from "../formatting";
import { resolveCtEntityIdentifier } from "../rendering-ixbrl";
import type { Ct600Draft } from "../types";
import type { ComputationsAttachmentRenderData } from "./types";

export function buildComputationsAttachmentRenderData(
  draft: Ct600Draft,
): ComputationsAttachmentRenderData {
  return {
    draft,
    entity: resolveCtEntityIdentifier(draft),
    instantContextId: "ct-context",
    durationSummaryContextId: "ct-context-summary",
    durationTradeDetailContextId: "ct-context-trade-detail",
    unitId: "unit",
    pureUnitId: "pure-unit",
    tradeBusinessName:
      draft.companyName.replace(/\s+/g, " ").trim() || "Main trade",
    periodUsesSmallProfitsRules:
      parseISO(draft.periodEnd).getTime() >=
      parseISO(SMALL_PROFITS_RATE_START).getTime(),
    rateBreakdownRows: draft.financialYearBreakdown.map((financialYear) => ({
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
    })),
    readyBanner: draft.filingReadiness.isReady
      ? `<div class="banner banner-ready"><strong>Filing-ready computation attachment.</strong> This document contains the structured HMRC CT computation facts for the supported small-company filing path.</div>`
      : `<div class="banner banner-draft"><strong>Draft review attachment.</strong> Clear the filing-readiness blockers before treating this computation attachment as filing-ready.</div>`,
  };
}
