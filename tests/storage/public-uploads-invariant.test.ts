import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

const SRC = path.resolve(process.cwd(), "src");

const WRITE_CALL =
  /\b(?:writeFileSync|writeFile|createWriteStream)\s*\(/;

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
  test("no runtime writes under public/", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const rel = path.relative(process.cwd(), file).split(path.sep).join("/");
      const source = readFileSync(file, "utf8");
      if (!WRITE_CALL.test(source)) continue;
      const writesPublic =
        /writeFile(?:Sync)?\([\s\S]{0,200}public/.test(source) ||
        /createWriteStream\([\s\S]{0,200}public/.test(source) ||
        /path\.join\([^)]*["']public["']/.test(source);
      if (!writesPublic) continue;
      offenders.push(rel);
    }
    assert.deepEqual(
      offenders,
      [],
      `Unexpected runtime writes under public/: ${offenders.join(", ")}`
    );
  });

  test("calendar covers cannot persist data URLs", () => {
    const create = readFileSync(
      path.join(process.cwd(), "src/app/api/academic-calendars/[calendarId]/events/route.ts"),
      "utf8"
    );
    const update = readFileSync(
      path.join(process.cwd(), "src/app/api/academic-calendars/[calendarId]/events/[eventId]/route.ts"),
      "utf8"
    );
    const uploader = readFileSync(
      path.join(process.cwd(), "src/components/ui/image-upload.tsx"),
      "utf8"
    );
    assert.match(create, /normalizePersistedAssetUrl/);
    assert.match(update, /normalizePersistedAssetUrl/);
    assert.match(uploader, /academic_calendar_cover/);
    assert.match(uploader, /cannot be stored as data URLs/);
    assert.equal(uploader.includes("onChange(result)"), false);
  });
});
