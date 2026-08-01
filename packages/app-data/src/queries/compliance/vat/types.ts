export type VatFilingActorId = string;

export type ComplianceAdjustmentLineCode =
  | "box1"
  | "box2"
  | "box3"
  | "box4"
  | "box5"
  | "box6"
  | "box7"
  | "box8"
  | "box9";

export type ComplianceObligationRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId: string | null;
  raw: unknown;
  createdAt: string;
  updatedAt: string;
};

export type VatReturnLineRecord = {
  code: string;
  label: string;
  amount: number;
  meta: unknown;
};

export type VatReturnRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  obligationId: string | null;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "ready" | "submitted" | "accepted" | "rejected";
  currency: string;
  netVatDue: number;
  submittedAt: string | null;
  externalSubmissionId: string | null;
  declarationAccepted: boolean;
  lines: VatReturnLineRecord[];
  createdAt: string;
  updatedAt: string;
};

export type ComplianceAdjustmentRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  vatReturnId: string | null;
  obligationId: string | null;
  effectiveDate: string;
  lineCode: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note: string | null;
  createdBy: VatFilingActorId | null;
  meta: unknown;
  createdAt: string;
};

export type EvidencePackRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  vatReturnId: string;
  checksum: string;
  payload: Record<string, unknown>;
  createdBy: VatFilingActorId | null;
  createdAt: string;
};

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
  createdBy: VatFilingActorId;
};

export type SubmitVatReturnParams = {
  teamId: string;
  vatReturnId: string;
  submittedBy: VatFilingActorId;
  declarationAccepted: boolean;
  userAgent?: string;
  publicIp?: string;
  idempotencyKey: string;
  confirmationId: string;
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
