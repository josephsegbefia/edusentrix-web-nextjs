import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkTsFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("Prompt 4 after() source gate", () => {
  test("no Next.js after() remains in src for business work", () => {
    const files = walkTsFiles("src");
    const hits: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (/from ["']next\/server["']/.test(source) && /\bafter\b/.test(source) && /after\(/.test(source)) {
        hits.push(file);
      }
    }
    assert.deepEqual(hits, []);
  });

  test("library import route enqueues instead of after()", () => {
    const source = readFileSync("src/app/api/admin/library/imports/route.ts", "utf8");
    assert.doesNotMatch(source, /after\(/);
    assert.match(source, /enqueueLibraryImportBackgroundJob/);
    assert.doesNotMatch(source, /executeLibraryImportJob/);
  });
});
