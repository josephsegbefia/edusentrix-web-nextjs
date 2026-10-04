import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BYTES_64MB,
  BYTES_8MB,
  STORAGE_KIND_REGISTRY,
  assertKindAllowsMime,
  maxBytesForKindMime,
} from "@/lib/storage/kinds";
import { STORAGE_KINDS } from "@/lib/storage/types";

describe("storage kind registry", () => {
  test("covers every declared kind", () => {
    for (const kind of STORAGE_KINDS) {
      assert.equal(STORAGE_KIND_REGISTRY[kind].kind, kind);
      assert.ok(STORAGE_KIND_REGISTRY[kind].limits.length > 0);
    }
  });

  test("preserves current size and type limits", () => {
    assert.equal(maxBytesForKindMime("student_avatar", "image/png"), BYTES_8MB);
    assert.equal(maxBytesForKindMime("teacher_document", "video/mp4"), BYTES_64MB);
    assert.equal(maxBytesForKindMime("teacher_document", "application/pdf"), 16 * 1024 * 1024);
    assert.equal(maxBytesForKindMime("expense_receipt", "application/pdf"), BYTES_8MB);
    assert.throws(() => assertKindAllowsMime("student_avatar", "application/pdf"));
  });

  test("uses gateway visibility defaults, not a public bucket", () => {
    assert.equal(STORAGE_KIND_REGISTRY.student_avatar.defaultVisibility, "public");
    assert.equal(STORAGE_KIND_REGISTRY.school_brand_image.defaultVisibility, "public");
    assert.equal(STORAGE_KIND_REGISTRY.library_book_cover.defaultVisibility, "public");
    assert.equal(STORAGE_KIND_REGISTRY.teacher_document.defaultVisibility, "private");
    assert.equal(STORAGE_KIND_REGISTRY.admission_document.defaultVisibility, "private");
    assert.equal(STORAGE_KIND_REGISTRY.parent_document.defaultVisibility, "private");
  });

  test("token kinds stay off the authenticated foundation route", () => {
    assert.equal(STORAGE_KIND_REGISTRY.admission_document.authPolicy, "token_admission");
    assert.equal(
      STORAGE_KIND_REGISTRY.parent_document.authPolicy,
      "token_or_authenticated_parent"
    );
  });

  test("profile and branding kinds skip the documents.storage gate", () => {
    assert.equal(STORAGE_KIND_REGISTRY.teacher_avatar.requiresDocumentsStorage, false);
    assert.equal(STORAGE_KIND_REGISTRY.school_brand_image.requiresDocumentsStorage, false);
    assert.equal(STORAGE_KIND_REGISTRY.teacher_document.requiresDocumentsStorage, true);
  });
});
