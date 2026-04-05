import type {
  ComplianceAdjustmentLineCode,
  CurrentUserIdentityRecord,
} from "../../../convex";

export type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type RecalculateVatDraftParams = {
  teamId: string;
  obligationId?: string;
  vatReturnId?: string;
};

export type AddVatAdjustmentParams = {
  teamId: string;
  obligationId?: string;
  vatReturnId?: string;
  lineCode: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note?: string | null;
  effectiveDate: string;
  createdBy: ConvexUserId;
};

export type SubmitVatReturnParams = {
  teamId: string;
  vatReturnId: string;
  submittedBy: ConvexUserId;
  declarationAccepted: boolean;
  userAgent?: string;
  publicIp?: string;
};

export type ListVatObligationsParams = {
  teamId: string;
};

export type GetEvidencePackParams = {
  teamId: string;
  evidencePackId: string;
};

export type GetVatDraftParams = {
  teamId: string;
  obligationId?: string;
  vatReturnId?: string;
};
