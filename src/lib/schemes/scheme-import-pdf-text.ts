import "server-only";
import { PDFParse } from "pdf-parse";

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const text = result.text?.trim() ?? "";
    return text;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
