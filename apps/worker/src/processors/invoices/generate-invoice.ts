import { getInvoiceById, updateInvoice } from "@tamias/app-data/queries";
import { PdfTemplate, renderToBuffer } from "@tamias/invoice";
import { enqueue } from "@tamias/job-client";
import { uploadVaultFile } from "@tamias/storage";
import type { WorkerJob as Job } from "../../types/job";
import type { GenerateInvoicePayload } from "../../schemas/invoices";
import { getDb } from "../../utils/db";
import { BaseProcessor } from "../base";

/**
 * Generate Invoice Processor
 * Handles PDF generation and storage upload for invoices
 * Optionally triggers email sending via send-invoice-email job
 */
export class GenerateInvoiceProcessor extends BaseProcessor<GenerateInvoicePayload> {
  async process(job: Job<GenerateInvoicePayload>): Promise<void> {
    const { invoiceId, deliveryType } = job.data;
    const db = getDb();

    this.logger.info("Starting invoice generation", {
      jobId: job.id,
      invoiceId,
      deliveryType,
    });

    // Fetch invoice data
    const invoiceData = await getInvoiceById(db, { id: invoiceId });

    if (!invoiceData) {
      this.logger.error("Failed to fetch invoice", { invoiceId });
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const { user, ...invoice } = invoiceData;

    this.logger.debug("Generating PDF", { invoiceId });

    // Generate PDF buffer
    const buffer = await renderToBuffer(await PdfTemplate(invoice));

    const filename = `${invoiceData.invoiceNumber}.pdf`;
    const fullPath = `${invoiceData.teamId}/invoices/${filename}`;

    this.logger.debug("Uploading PDF to storage", {
      invoiceId,
      fullPath,
      fileSize: buffer.length,
    });

    const { error: uploadError } = await uploadVaultFile({
      path: fullPath,
      blob: buffer,
      contentType: "application/pdf",
      size: buffer.length,
      upsert: true,
    });

    if (uploadError) {
      this.logger.error("Failed to upload PDF", {
        invoiceId,
        error: uploadError.message,
      });
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    this.logger.debug("PDF uploaded to storage", { invoiceId, fullPath });

    // Update invoice with the generated file path and size
    const updated = await updateInvoice(db, {
      id: invoiceId,
      teamId: invoiceData.teamId,
      filePath: [invoiceData.teamId, "invoices", filename],
      fileSize: buffer.length,
    });

    if (!updated) {
      this.logger.error("Failed to update invoice with file info", {
        invoiceId,
      });
      throw new Error("Failed to update invoice with file info");
    }

    // Queue email sending if delivery type is create_and_send
    if (deliveryType === "create_and_send") {
      await enqueue(
        "send-invoice-email",
        {
          invoiceId,
          filename,
          fullPath,
        },
        "invoices",
        {
          publicTeamId: invoiceData.teamId,
          metadata: {
            source: "generate-invoice",
            invoiceId,
          },
        },
      );

      this.logger.debug("Queued send-invoice-email job", { invoiceId });
    }

    // Queue document processing for classification
    await enqueue(
      "process-document",
      {
        filePath: [invoiceData.teamId, "invoices", filename],
        mimetype: "application/pdf",
        teamId: invoiceData.teamId,
      },
      "documents",
      {
        publicTeamId: invoiceData.teamId,
        metadata: {
          source: "generate-invoice",
          invoiceId,
        },
      },
    );

    this.logger.info("Invoice generation completed", {
      invoiceId,
      filename,
      fullPath,
      deliveryType,
    });
  }
}
