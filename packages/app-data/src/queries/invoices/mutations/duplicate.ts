import { generateToken } from "@tamias/invoice/token";
import { addMonths } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { Database } from "../../../client";
import { logActivity, type InvoiceActivityType } from "../../../utils/log-activity";
import { draftInvoice } from "./draft";
import { getInvoiceById } from "../reads";
import type { DraftInvoiceTemplateParams, InvoiceConvexUserId } from "../shared";

export type DuplicateInvoiceParams = {
  id: string;
  userId: InvoiceConvexUserId;
  invoiceNumber: string;
  teamId: string;
};

export async function duplicateInvoice(db: Database, params: DuplicateInvoiceParams) {
  const { id, userId, invoiceNumber, teamId } = params;
  const invoice = await getInvoiceById(db, {
    id,
    teamId,
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const draftId = uuidv4();
  const token = await generateToken(draftId);

  const result = await draftInvoice(db, {
    id: draftId,
    token,
    userId,
    teamId: invoice.teamId,
    template: invoice.template as DraftInvoiceTemplateParams,
    dueDate: addMonths(new Date(), 1).toISOString(),
    issueDate: new Date().toISOString(),
    invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    vat: invoice.vat,
    tax: invoice.tax,
    discount: invoice.discount,
    subtotal: invoice.subtotal,
    amount: invoice.amount,
    // @ts-expect-error - JSONB
    paymentDetails: invoice.paymentDetails,
    // @ts-expect-error - JSONB
    noteDetails: invoice.noteDetails,
    // @ts-expect-error - JSONB
    topBlock: invoice.topBlock,
    // @ts-expect-error - JSONB
    bottomBlock: invoice.bottomBlock,
    // @ts-expect-error - JSONB
    fromDetails: invoice.fromDetails,
    // @ts-expect-error - JSONB
    customerDetails: invoice.customerDetails,
    lineItems: invoice.lineItems,
  });

  logActivity({
    db,
    teamId,
    userId,
    type: "invoice_duplicated" satisfies InvoiceActivityType,
    metadata: {
      originalInvoiceId: id,
      newInvoiceId: result?.id,
      newInvoiceNumber: result?.invoiceNumber,
    },
  });

  return result;
}
