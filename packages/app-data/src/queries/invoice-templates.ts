import {
  createInvoiceTemplateInConvex,
  deleteInvoiceTemplateInConvex,
  getDefaultInvoiceTemplateFromConvex,
  getInvoiceTemplateByIdFromConvex,
  getInvoiceTemplateCountFromConvex,
  getInvoiceTemplatesFromConvex,
  setDefaultInvoiceTemplateInConvex,
  type InvoiceTemplateDeleteResult,
  type InvoiceTemplateRecord,
  upsertInvoiceTemplateInConvex,
} from "@tamias/app-data-convex";

export type InvoiceTemplateParams = Omit<InvoiceTemplateRecord, "id" | "name" | "isDefault">;

export type CreateInvoiceTemplateParams = {
  teamId: string;
  name: string;
  isDefault?: boolean;
} & InvoiceTemplateParams;

export type UpsertInvoiceTemplateParams = {
  id?: string;
  teamId: string;
  name?: string;
} & InvoiceTemplateParams;

export type InvoiceTemplate = InvoiceTemplateRecord;

function toTemplateData(
  params: InvoiceTemplateParams,
): Omit<InvoiceTemplateRecord, "id" | "name" | "isDefault"> {
  return { ...params };
}

export async function getInvoiceTemplates(teamId: string) {
  return getInvoiceTemplatesFromConvex({ teamId });
}

export async function getInvoiceTemplateById(params: { id: string; teamId: string }) {
  return getInvoiceTemplateByIdFromConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

export async function getInvoiceTemplate(teamId: string) {
  return getDefaultInvoiceTemplateFromConvex({ teamId });
}

export async function createInvoiceTemplate(params: CreateInvoiceTemplateParams) {
  const { teamId, name, isDefault, ...templateData } = params;

  return createInvoiceTemplateInConvex({
    teamId,
    name,
    isDefault,
    templateData: toTemplateData(templateData),
  });
}

export async function upsertInvoiceTemplate(params: UpsertInvoiceTemplateParams) {
  const { id, teamId, name, ...templateData } = params;

  return upsertInvoiceTemplateInConvex({
    id,
    teamId,
    name,
    templateData: toTemplateData(templateData),
  });
}

export async function setDefaultTemplate(params: { id: string; teamId: string }) {
  return setDefaultInvoiceTemplateInConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

export async function deleteInvoiceTemplate(params: {
  id: string;
  teamId: string;
}): Promise<InvoiceTemplateDeleteResult> {
  return deleteInvoiceTemplateInConvex({
    id: params.id,
    teamId: params.teamId,
  });
}

export async function getInvoiceTemplateCount(teamId: string) {
  return getInvoiceTemplateCountFromConvex({ teamId });
}
