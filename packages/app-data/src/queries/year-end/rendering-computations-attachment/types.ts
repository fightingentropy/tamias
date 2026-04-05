import type { Ct600Draft } from "../types";

export type ComputationsAttachmentRow = {
  label: string;
  value: string;
};

export type ComputationsAttachmentRenderData = {
  draft: Ct600Draft;
  entity: {
    scheme: string;
    identifier: string;
  };
  instantContextId: string;
  durationSummaryContextId: string;
  durationTradeDetailContextId: string;
  unitId: string;
  pureUnitId: string;
  tradeBusinessName: string;
  periodUsesSmallProfitsRules: boolean;
  rateBreakdownRows: ComputationsAttachmentRow[];
  readyBanner: string;
};
