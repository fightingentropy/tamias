import { roundCurrency } from "@tamias/compliance";
import { escapeXml } from "./formatting";
import type { Ct600Draft, StatutoryAccountsDraft } from "./types";

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

function resolveFallbackEntityIdentifier(companyName: string) {
  return {
    scheme: "https://tamias.local/entity",
    identifier: companyName.replaceAll(/\s+/g, "-").toLowerCase(),
  };
}

export function formatIxbrlAmount(amount: number) {
  return roundCurrency(amount).toFixed(2);
}

export function formatIxbrlWholeNumber(value: number) {
  return Math.round(value).toString();
}

export function resolveAccountsEntityIdentifier(draft: StatutoryAccountsDraft) {
  if (draft.companyNumber) {
    return {
      scheme: "http://www.companieshouse.gov.uk/",
      identifier: draft.companyNumber,
    };
  }

  return resolveFallbackEntityIdentifier(draft.companyName);
}

export function resolveCtEntityIdentifier(draft: Ct600Draft) {
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

  return resolveFallbackEntityIdentifier(draft.companyName);
}

export function renderInlineXbrlContext(context: InlineXbrlContext) {
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
  const segmentMarkup = membersMarkup ? `<xbrli:segment>${membersMarkup}</xbrli:segment>` : "";

  return `<xbrli:context id="${escapeXml(context.id)}"><xbrli:entity><xbrli:identifier scheme="${escapeXml(
    context.scheme,
  )}">${escapeXml(context.identifier)}</xbrli:identifier>${segmentMarkup}</xbrli:entity>${periodMarkup}</xbrli:context>`;
}

export function renderInlineXbrlUnit(id: string, measure: string) {
  return `<xbrli:unit id="${escapeXml(id)}"><xbrli:measure>${escapeXml(
    measure,
  )}</xbrli:measure></xbrli:unit>`;
}

export function renderPlainRows(
  rows: Array<{
    label: string;
    value: string;
  }>,
) {
  return rows
    .map(
      (row) =>
        `<tr><td>${escapeXml(row.label)}</td><td class="amount">${escapeXml(row.value)}</td></tr>`,
    )
    .join("");
}

export function renderBulletList(items: string[]) {
  if (!items.length) {
    return "";
  }

  return `<ul>${items.map((item) => `<li>${escapeXml(item)}</li>`).join("")}</ul>`;
}
