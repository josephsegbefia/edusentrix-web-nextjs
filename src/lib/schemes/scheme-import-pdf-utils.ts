import "server-only";

import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

let pdfWorkerReady = false;

const PDF_WORKER_CANDIDATES = [
  "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs",
  "node_modules/pdf-parse/dist/worker/pdf.worker.mjs",
  "node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs",
];

function resolvePdfWorkerPath(): string | null {
  for (const relative of PDF_WORKER_CANDIDATES) {
    const absolute = path.join(process.cwd(), relative);
    if (fs.existsSync(absolute)) return absolute;
  }
  return null;
}

/** Configure pdf.js worker once (optional; text extraction often works without it in Node). */
export function ensurePdfParseWorker(): void {
  if (pdfWorkerReady) return;
  const workerPath = resolvePdfWorkerPath();
  if (workerPath) {
    PDFParse.setWorker(workerPath);
  }
  pdfWorkerReady = true;
}

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

export function isPdfSource(fileName: string, mimeType?: string | null): boolean {
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return true;
  return fileName.toLowerCase().trim().endsWith(".pdf");
}
