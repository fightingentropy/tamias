import { escapeXml } from "../../formatting";
import { HMRC_ACCEPTED_FRC_2025_FRS_102_ENTRY_POINT } from "../../constants";
import { renderInlineXbrlContext, renderInlineXbrlUnit } from "../../rendering-ixbrl";
import type { AccountsAttachmentRenderData } from "../types";

export function renderAccountsAttachmentHeader(data: AccountsAttachmentRenderData) {
  const { draft, entity } = data;

  return `<div class="hidden">
      <ix:header>
        <ix:references>
          <link:schemaRef xlink:type="simple" xlink:href="${escapeXml(
            HMRC_ACCEPTED_FRC_2025_FRS_102_ENTRY_POINT,
          )}" />
        </ix:references>
        <ix:resources>
          ${renderInlineXbrlContext({
            id: data.durationContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            startDate: draft.periodStart,
            endDate: draft.periodEnd,
          })}
          ${renderInlineXbrlContext({
            id: data.instantContextId,
            scheme: entity.scheme,
            identifier: entity.identifier,
            instant: draft.periodEnd,
          })}
          ${renderInlineXbrlContext({
            id: data.accountsStatusContextId,
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
            id: data.accountsTypeContextId,
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
            id: data.accountingStandardsContextId,
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
          ${data.directorContexts
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
          ${renderInlineXbrlUnit(data.monetaryUnitId, `iso4217:${draft.currency.toUpperCase()}`)}
          ${renderInlineXbrlUnit(data.pureUnitId, "xbrli:pure")}
          ${renderInlineXbrlUnit(data.sharesUnitId, "xbrli:shares")}
        </ix:resources>
      </ix:header>
    </div>`;
}
