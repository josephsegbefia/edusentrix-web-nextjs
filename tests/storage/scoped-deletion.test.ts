import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";
import {
  SCHOOL_A,
  SCHOOL_B,
  assetPath,
  resetStorageDb,
  seedAsset,
  startStorageDb,
  stopStorageDb,
} from "./helpers/school-fixtures";

stubServerOnly();

let service: typeof import("@/lib/storage/service");
let uploads: typeof import("@/lib/uploads/delete");
let publicRollback: typeof import("@/lib/uploads/public-rollback");

before(
  async () => {
    await startStorageDb("scoped_deletion");
    service = await import("@/lib/storage/service");
    uploads = await import("@/lib/uploads/delete");
    publicRollback = await import("@/lib/uploads/public-rollback");
  },
  { timeout: 180_000 }
);

after(stopStorageDb);
beforeEach(resetStorageDb);

async function statusOf(id: Types.ObjectId) {
  const doc = await mongoose.model("StoredAsset").collection.findOne({ _id: id });
  return doc?.status;
}

describe("scoped soft delete", () => {
  test("an unscoped delete with no actor is refused", async () => {
    const assetId = await seedAsset();
    assert.equal(await service.softDeleteStoredAssetUrl(assetPath(assetId), null), false);
    assert.equal(await statusOf(assetId), "ready");
  });

  test("a cross-school or wrong-kind delete is refused", async () => {
    const assetId = await seedAsset({ kind: "student_avatar" });
    assert.equal(
      await uploads.deleteUploadedFile(assetPath(assetId), { schoolId: SCHOOL_B, kinds: "all" }),
      false
    );
    assert.equal(
      await uploads.deleteUploadedFile(assetPath(assetId), { schoolId: SCHOOL_A, kinds: ["teacher_avatar"] }),
      false
    );
    assert.equal(await statusOf(assetId), "ready");
  });

  test("a delete limited to the caller's upload leaves other uploads alone", async () => {
    const owner = new Types.ObjectId();
    const assetId = await seedAsset({ kind: "teacher_document", uploadedByUserId: owner });
    const scope = { schoolId: SCHOOL_A, kinds: ["teacher_document" as const] };
    assert.equal(
      await uploads.deleteUploadedFile(assetPath(assetId), { ...scope, uploadedByUserId: new Types.ObjectId() }),
      false
    );
    assert.equal(await uploads.deleteUploadedFile(assetPath(assetId), { ...scope, uploadedByUserId: owner }), true);
    assert.equal(await statusOf(assetId), "deleted");
  });

  test("publicUploadsOnly refuses signed-in uploads and linked assets", async () => {
    const signedInUpload = await seedAsset({ kind: "admission_document" });
    const linked = await seedAsset({
      kind: "admission_document",
      uploadedByUserId: null,
      association: { type: "application", id: new Types.ObjectId() },
    });
    const anonymous = await seedAsset({ kind: "admission_document", uploadedByUserId: null });
    const scope = { schoolId: SCHOOL_A, kinds: ["admission_document" as const], publicUploadsOnly: true };
    assert.equal(await uploads.deleteUploadedFile(assetPath(signedInUpload), scope), false);
    assert.equal(await uploads.deleteUploadedFile(assetPath(linked), scope), false);
    assert.equal(await uploads.deleteUploadedFile(assetPath(anonymous), scope), true);
  });
});

describe("public rollback", () => {
  test("refuses a document another application already references", async () => {
    const assetId = await seedAsset({ kind: "admission_document", uploadedByUserId: null });
    await mongoose.model("AdmissionApplication").collection.insertOne({
      _id: new Types.ObjectId(),
      schoolId: SCHOOL_A,
      documents: [{ requirementId: "r1", label: "Birth certificate", fileUrl: assetPath(assetId) }],
    });
    assert.equal(
      await publicRollback.rollbackPublicUpload(assetPath(assetId), {
        schoolId: SCHOOL_A,
        kind: "admission_document",
      }),
      false
    );
    assert.equal(await statusOf(assetId), "ready");
  });

  test("never deletes a student photo", async () => {
    const assetId = await seedAsset({ kind: "student_avatar", uploadedByUserId: null });
    assert.equal(
      await publicRollback.rollbackPublicUpload(assetPath(assetId), {
        schoolId: SCHOOL_A,
        kind: "admission_document",
      }),
      false
    );
    assert.equal(await statusOf(assetId), "ready");
  });

  test("a public attach with an unresolved token deletes nothing", async () => {
    const victims = [
      await seedAsset({ kind: "student_avatar" }),
      await seedAsset({ kind: "admission_document", uploadedByUserId: null }),
      await seedAsset({ kind: "parent_document", uploadedByUserId: null }),
    ];
    const routes: Array<[string, string]> = [
      ["@/app/api/public/admissions/supplemental/[token]/attach/route", "x".repeat(32)],
      ["@/app/api/public/admissions/applications/[token]/documents/route", "y".repeat(32)],
      ["@/app/api/public/students/parent-documents/[token]/attach/route", "z".repeat(32)],
    ];
    for (const [specifier, token] of routes) {
      const { POST } = (await import(specifier)) as {
        POST: (req: NextRequest, ctx: { params: Promise<{ token: string }> }) => Promise<Response>;
      };
      for (const victim of victims) {
        const req = new NextRequest(`http://localhost/api/public/${token}`, {
          method: "POST",
          body: JSON.stringify({
            requirementId: "r1",
            label: "Doc",
            fileUrl: `https://app.example.test${assetPath(victim)}`,
          }),
          headers: { "content-type": "application/json" },
        });
        const res = await POST(req, { params: Promise.resolve({ token }) });
        assert.equal(res.status, 404);
      }
    }
    for (const victim of victims) {
      assert.equal(await statusOf(victim), "ready");
    }
  });

  test("an application submission for an unknown cycle deletes nothing", async () => {
    const victim = await seedAsset({ kind: "admission_document", uploadedByUserId: null });
    const { POST } = (await import("@/app/api/public/admissions/[schoolId]/[cycleSlug]/applications/route")) as {
      POST: (
        req: NextRequest,
        ctx: { params: Promise<{ schoolId: string; cycleSlug: string }> }
      ) => Promise<Response>;
    };
    const req = new NextRequest("http://localhost/api/public/admissions/x/y/applications", {
      method: "POST",
      body: JSON.stringify({
        answers: {},
        documents: [{ requirementId: "r1", fileUrl: assetPath(victim) }],
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ schoolId: String(SCHOOL_A), cycleSlug: "no-such-cycle" }),
    });
    assert.equal(res.status, 404);
    assert.equal(await statusOf(victim), "ready");
  });
});
