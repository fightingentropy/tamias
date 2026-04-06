/**
 * PDF text extraction stub.
 * The unpdf/pdfjs dependency (~1.8 MB) has been removed.
 * Callers already treat a null return as "text extraction unavailable"
 * and fall back to other extraction strategies.
 */
export async function extractTextFromPdf(
  _pdfUrl: string,
  _pdfBuffer?: ArrayBuffer,
): Promise<string | null> {
  return null;
}
