import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

const SRC = path.resolve(process.cwd(), "src");
const LEGACY_EXCEPTION = path.normalize(
  "src/app/api/parent/documents/upload/route.ts"
);

const WRITE_CALL =
  /\b(?:writeFileSync|writeFile|createWriteStream)\s*\(/;
const PUBLIC_HINT = /["'`][^"'`]*public[^"'`]*["'`]|public\/uploads|["'`]uploads["'`]/;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) files.push(full);
  }
  return files;
}

describe("public/ runtime write invariant", () => {
  test("only the documented parent-document route writes under public/", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(process.cwd(), file).split(path.sep).join("/");
      const source = readFileSync(file, "utf8");
      if (!WRITE_CALL.test(source)) continue;
      if (!PUBLIC_HINT.test(source) && !source.includes("public") ) continue;
      const writesPublic =
        /writeFile(?:Sync)?\([\s\S]{0,200}public/.test(source) ||
        /createWriteStream\([\s\S]{0,200}public/.test(source) ||
        /path\.join\([^)]*["']public["']/.test(source);
      if (!writesPublic) continue;
      if (rel === LEGACY_EXCEPTION) continue;
      offenders.push(rel);
    }
    assert.deepEqual(
      offenders,
      [],
      `Unexpected runtime writes under public/: ${offenders.join(", ")}`
    );
  });
});
