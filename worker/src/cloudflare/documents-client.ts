type DocumentsWorkerBinding = {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
};

let documentsWorkerBinding: DocumentsWorkerBinding | null = null;

export function configureDocumentsWorkerBinding(binding?: DocumentsWorkerBinding | null) {
  documentsWorkerBinding = binding ?? null;
}

export async function renderInvoicePdfInDocumentsWorker(
  invoiceData: unknown,
  options?: {
    isReceipt?: boolean;
  },
) {
  if (!documentsWorkerBinding) {
    throw new Error("DOCUMENTS_WORKER service binding is not configured");
  }

  const response = await documentsWorkerBinding.fetch(
    "https://documents-worker.local/render-invoice-pdf",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        invoiceData,
        isReceipt: options?.isReceipt === true,
      }),
    },
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorPayload?.error ?? `Documents worker failed with HTTP ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
