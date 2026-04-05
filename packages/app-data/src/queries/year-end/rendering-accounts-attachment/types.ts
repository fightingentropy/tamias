import type { StatutoryAccountsDraft } from "../types";

export type AccountsAttachmentDirectorContext = {
  id: string;
  name: string;
  explicitMembers: Array<{
    dimension: string;
    value: string;
  }>;
};

export type AccountsAttachmentRenderData = {
  draft: StatutoryAccountsDraft;
  entity: {
    scheme: string;
    identifier: string;
  };
  durationContextId: string;
  instantContextId: string;
  accountsStatusContextId: string;
  accountsTypeContextId: string;
  accountingStandardsContextId: string;
  monetaryUnitId: string;
  pureUnitId: string;
  sharesUnitId: string;
  currentTaxForPeriod: number;
  profitBeforeTax: number;
  profitAfterTax: number;
  totalAssetsLessCurrentLiabilities: number;
  isDormant: boolean;
  directorContexts: AccountsAttachmentDirectorContext[];
  signingDirector?: AccountsAttachmentDirectorContext;
  formattedPeriodStart: string;
  formattedPeriodEnd: string;
  formattedApprovalDate: string | null;
  registeredNumberText: string;
  coverTitle: string;
  readyBanner: string;
  statementsMarkup: string;
};
