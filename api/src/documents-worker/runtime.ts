type DocumentsWorkerBinding = {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
};

let documentsWorkerBinding: DocumentsWorkerBinding | null = null;

export function configureDocumentsWorkerRuntime(binding?: DocumentsWorkerBinding | null) {
  documentsWorkerBinding = binding ?? null;
}

export function requireDocumentsWorkerRuntime() {
  if (!documentsWorkerBinding) {
    throw new Error("DOCUMENTS_WORKER service binding is not configured");
  }

  return documentsWorkerBinding;
}
