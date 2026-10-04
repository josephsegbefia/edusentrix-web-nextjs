import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

const SRC = path.resolve(process.cwd(), "src");

const FORBIDDEN = [
  /from\s+["']uploadthing/,
  /from\s+["']@uploadthing/,
  /\bUTApi\b/,
  /\/api\/uploadthing/,
  /\/api\/uploads\/sign/,
  /from\s+["']cloudinary/,
  /from\s+["']next-cloudinary/,
  /\buseUploadThing\b/,
  /\bcreateUploadthing\b/,
  /uploadFiles\(/,
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) files.push(full);
  }
  return files;
}

function scan(root: string) {
  const offenders: string[] = [];
  for (const file of walk(root)) {
    const rel = path.relative(process.cwd(), file).split(path.sep).join("/");
    const source = readFileSync(file, "utf8");
    for (const pattern of FORBIDDEN) {
      if (pattern.test(source)) {
        offenders.push(`${rel} matches ${pattern}`);
      }
    }
  }
  return offenders;
}

describe("R2 cutover source gates", () => {
  test("src has no UploadThing or Cloudinary storage imports", () => {
    assert.deepEqual(scan(SRC), []);
  });

  test("client uploaders use the R2 adapter", () => {
    const files = [
      "src/components/upload/ImageUploader.tsx",
      "src/components/upload/DocumentUploader.tsx",
      "src/components/admissions/public/PublicDocumentUploader.tsx",
      "src/components/schemes/SchemeImportDocumentUploader.tsx",
      "src/components/admin/library/LibraryBookCoverUpload.tsx",
      "src/components/admin/students/detail/StudentDetailAvatar.tsx",
      "src/components/admin/teachers/detail/TeacherDetailAvatar.tsx",
      "src/components/teacher/lesson-notes/steps/ResourcesStep.tsx",
      "src/components/lessons/blocks/LessonBlockEditors.tsx",
      "src/hooks/useUploadFile.ts",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      assert.match(source, /uploadFileToStorage/);
    }
  });
});
