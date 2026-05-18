import path from "node:path";
import { PDFParse } from "pdf-parse";

async function test(withWorker: boolean) {
  if (withWorker) {
    const workerPath = path.join(
      process.cwd(),
      "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs",
    );
    PDFParse.setWorker(workerPath);
  }
  const res = await fetch("https://bitcoin.org/bitcoin.pdf");
  const buf = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    console.log(withWorker ? "WITH worker" : "NO worker", "len", result.text.length);
  } catch (e) {
    console.error(withWorker ? "WITH worker FAIL" : "NO worker FAIL", e instanceof Error ? e.message : e);
  } finally {
    await parser.destroy();
  }
}

await test(false);
await test(true);
