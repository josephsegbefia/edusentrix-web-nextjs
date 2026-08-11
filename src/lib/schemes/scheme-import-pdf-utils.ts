import "server-only";

import fs from "node:fs";
import path from "node:path";

let pdfWorkerReady = false;
let pdfParseModulePromise: Promise<typeof import("pdf-parse")> | null = null;

class NodeDomMatrixFallback {
  readonly is2D = true;
  readonly isIdentity = true;
  readonly a = 1;
  readonly b = 0;
  readonly c = 0;
  readonly d = 1;
  readonly e = 0;
  readonly f = 0;
  readonly m11 = 1;
  readonly m12 = 0;
  readonly m13 = 0;
  readonly m14 = 0;
  readonly m21 = 0;
  readonly m22 = 1;
  readonly m23 = 0;
  readonly m24 = 0;
  readonly m31 = 0;
  readonly m32 = 0;
  readonly m33 = 1;
  readonly m34 = 0;
  readonly m41 = 0;
  readonly m42 = 0;
  readonly m43 = 0;
  readonly m44 = 1;

  constructor(_init?: string | number[]) {}
  multiply() { return this; }
  translate() { return this; }
  scale() { return this; }
  rotate() { return this; }
  inverse() { return this; }
  transformPoint(point?: DOMPointInit) { return point ?? { x: 0, y: 0 }; }
  toFloat32Array() { return new Float32Array([1, 0, 0, 1, 0, 0]); }
  toFloat64Array() { return new Float64Array([1, 0, 0, 1, 0, 0]); }
  toString() { return "matrix(1, 0, 0, 1, 0, 0)"; }
}

class NodeImageDataFallback {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace = "srgb";

  constructor(dataOrWidth: Uint8ClampedArray | number, width?: number, height?: number) {
    if (typeof dataOrWidth === "number") {
      this.width = dataOrWidth;
      this.height = Number(width ?? 0);
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = Number(width ?? 0);
      this.height = Number(height ?? 0);
    }
  }
}

class NodePath2DFallback {
  constructor(_path?: string | NodePath2DFallback) {}
  addPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
  roundRect() {}
}

function installPdfJsNodePolyfills() {
  const globalRef = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };
  globalRef.DOMMatrix ??= NodeDomMatrixFallback as unknown as typeof DOMMatrix;
  globalRef.ImageData ??= NodeImageDataFallback as unknown as typeof ImageData;
  globalRef.Path2D ??= NodePath2DFallback as unknown as typeof Path2D;
}

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
export async function getPdfParseModule(): Promise<typeof import("pdf-parse")> {
  installPdfJsNodePolyfills();
  pdfParseModulePromise ??= import("pdf-parse");
  const mod = await pdfParseModulePromise;
  ensurePdfParseWorker(mod.PDFParse);
  return mod;
}

/** Configure pdf.js worker once (optional; text extraction often works without it in Node). */
function ensurePdfParseWorker(PDFParse: typeof import("pdf-parse").PDFParse): void {
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
