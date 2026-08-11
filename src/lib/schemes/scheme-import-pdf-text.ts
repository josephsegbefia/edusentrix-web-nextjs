import "server-only";

import { getPdfParseModule, isPdfBuffer } from "@/lib/schemes/scheme-import-pdf-utils";

const MIN_TEXT_CHARS = 40;

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  if (!isPdfBuffer(buffer)) {
    throw new Error("File is not a valid PDF");
  }

  const { PDFParse } = await getPdfParseModule();

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text?.replace(/\u0000/g, "").trim() ?? "";
    if (text.length < MIN_TEXT_CHARS) {
      throw new Error(
        "No extractable text from PDF (scanned/image-only PDFs are not supported — use a text-based PDF or CSV/XLSX)",
      );
    }
    return text;
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("No extractable text")) {
      throw e;
    }
    const message = e instanceof Error ? e.message : "PDF read failed";
    throw new Error(
      message.includes("password")
        ? "PDF is password-protected — remove protection and try again"
        : `PDF read failed: ${message}`,
    );
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
