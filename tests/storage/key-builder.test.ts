import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildStorageKey, extensionForMimeType } from "@/lib/storage/key-builder";

const schoolId = "64b7f0c2a1d2e3f405060708";
const studentId = "64b7f0c2a1d2e3f405060709";

describe("storage key builder", () => {
  test("is tenant-first and UUID-generated without the original filename", () => {
    const built = buildStorageKey({
      schoolId,
      kind: "student_record_document",
      mimeType: "application/pdf",
      association: { type: "student", id: studentId },
    });
    assert.match(built.storageKey, new RegExp(`^schools/${schoolId}/students/${studentId}/records/`));
    assert.match(built.assetUuid, /^[0-9a-f-]{36}$/);
    assert.ok(!built.storageKey.includes("report-card"));
    assert.ok(!built.storageKey.includes("Jane"));
    assert.ok(built.storageKey.endsWith(`${built.assetUuid}.pdf`));
  });

  test("uses the pending prefix when the domain entity is not known", () => {
    const built = buildStorageKey({
      schoolId,
      kind: "admission_document",
      mimeType: "image/png",
    });
    assert.equal(
      built.storageKey,
      `schools/${schoolId}/pending/admission_document/${built.assetUuid}.png`
    );
  });

  test("rejects path traversal and non-ObjectId school ids", () => {
    assert.throws(
      () =>
        buildStorageKey({
          schoolId: "../etc/passwd",
          kind: "student_avatar",
          mimeType: "image/jpeg",
        }),
      /Invalid schoolId/
    );
    assert.throws(
      () =>
        buildStorageKey({
          schoolId: "not-an-object-id",
          kind: "student_avatar",
          mimeType: "image/jpeg",
        }),
      /Invalid schoolId/
    );
    assert.throws(
      () =>
        buildStorageKey({
          schoolId,
          kind: "student_avatar",
          mimeType: "image/jpeg",
          association: { type: "student", id: "../../secret" },
        }),
      /Invalid (student|association) id/
    );
  });

  test("does not embed school names, emails, or tokens", () => {
    const built = buildStorageKey({
      schoolId,
      kind: "school_brand_image",
      mimeType: "image/png",
    });
    assert.equal(built.storageKey, `schools/${schoolId}/branding/logo/${built.assetUuid}.png`);
    assert.ok(!built.storageKey.toLowerCase().includes("edusentrix"));
    assert.ok(!built.storageKey.includes("@"));
  });

  test("normalizes extensions from MIME, not the filename", () => {
    assert.equal(extensionForMimeType("image/jpg"), "jpg");
    assert.equal(extensionForMimeType("image/jpeg; charset=binary"), "jpg");
    const built = buildStorageKey({
      schoolId,
      kind: "teacher_document",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    assert.ok(built.storageKey.endsWith(".docx"));
  });

  test("gives store products a prefix distinct from branding", () => {
    const productId = "64b7f0c2a1d2e3f40506070a";
    const built = buildStorageKey({
      schoolId,
      kind: "store_product_image",
      mimeType: "image/webp",
      association: { type: "product", id: productId },
    });
    assert.match(built.storageKey, /\/store\/products\//);
    assert.ok(!built.storageKey.includes("/branding/"));
  });
});
