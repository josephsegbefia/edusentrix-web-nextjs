import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import { createMockR2Port } from "./helpers/mock-r2";
import {
  SCHOOL_A,
  SCHOOL_B,
  actor,
  resetStorageDb,
  seedApplicationWithTracker,
  seedAsset,
  seedParentDocumentRequest,
  seedStudent,
  seedSupplementalRequest,
  startStorageDb,
  stopStorageDb,
} from "./helpers/school-fixtures";
import { setActiveSchool, stubStorageRouteDeps } from "./helpers/stub-storage-route-deps";
import type { StorageActor } from "@/lib/storage/types";

stubStorageRouteDeps();

type RouteGet = (
  req: NextRequest,
  ctx: { params: Promise<{ assetId: string }> }
) => Promise<Response>;
type RoutePost = (req: Request) => Promise<Response>;

let policy: typeof import("@/lib/storage/access-policy");
let service: typeof import("@/lib/storage/service");
let publicToken: typeof import("@/lib/storage/public-token");
let gatewayRoute: RouteGet;
let completeRoute: RoutePost;
let r2: ReturnType<typeof createMockR2Port>;

before(
  async () => {
    await startStorageDb("document_token_access");
    const { setR2PortForTests } = await import("@/lib/storage/r2");
    r2 = createMockR2Port();
    setR2PortForTests(r2);
    policy = await import("@/lib/storage/access-policy");
    service = await import("@/lib/storage/service");
    publicToken = await import("@/lib/storage/public-token");
    gatewayRoute = (await import("@/app/api/storage/assets/[assetId]/route")).GET as unknown as RouteGet;
    completeRoute = (await import("@/app/api/storage/public/uploads/complete/route")).POST as RoutePost;
  },
  { timeout: 180_000 }
);

after(async () => {
  const { setR2PortForTests } = await import("@/lib/storage/r2");
  setR2PortForTests(null);
  await stopStorageDb();
});

beforeEach(async () => {
  setActiveSchool(undefined);
  r2.objects.clear();
  await resetStorageDb();
});

const PDF = "application/pdf";

function doc(kind: "admission_document" | "parent_document", association: { type: string; id: Types.ObjectId }, schoolId = SCHOOL_A) {
  return seedAsset({ kind, mimeType: PDF, association, schoolId });
}

async function canRead(assetId: Types.ObjectId, token: string, reader: StorageActor | null = null) {
  const { StoredAsset } = await import("@/models/StoredAsset");
  const asset = await StoredAsset.findById(assetId);
  assert.ok(asset);
  return (await policy.authorizeStoredAssetRead({ asset, actor: reader, accessToken: token })).allowed;
}

function gateway(assetId: string, token?: string) {
  const query = token === undefined ? "" : `?token=${encodeURIComponent(token)}`;
  const req = new NextRequest(`http://localhost/api/storage/assets/${assetId}${query}`);
  return gatewayRoute(req, { params: Promise.resolve({ assetId }) });
}

describe("document request tokens are bound to their own request", () => {
  test("a parent request token opens only its own request's document", async () => {
    const student = await seedStudent();
    const otherStudent = await seedStudent();
    const own = await seedParentDocumentRequest({ studentId: student });
    const sibling = await seedParentDocumentRequest({ studentId: student });
    const elsewhere = await seedParentDocumentRequest({ studentId: otherStudent });

    const ownDoc = await doc("parent_document", { type: "request", id: own.requestId });
    const siblingDoc = await doc("parent_document", { type: "request", id: sibling.requestId });
    const elsewhereDoc = await doc("parent_document", { type: "request", id: elsewhere.requestId });

    assert.equal(await canRead(ownDoc, own.token), true);
    assert.equal(await canRead(siblingDoc, own.token), false, "same student, other request");
    assert.equal(await canRead(elsewhereDoc, own.token), false, "same school, other student");
    assert.equal(await canRead(elsewhereDoc, elsewhere.token), true);
  });

  test("a fulfilled request keeps access to its own document", async () => {
    const student = await seedStudent();
    const request = await seedParentDocumentRequest({ studentId: student });
    await mongoose
      .model("Student")
      .collection.updateOne(
        { _id: student, "parentDocumentRequests._id": request.requestId },
        { $set: { "parentDocumentRequests.$.fulfilledAt": new Date() } }
      );
    const ownDoc = await doc("parent_document", { type: "request", id: request.requestId });
    assert.equal(await canRead(ownDoc, request.token), true);
  });

  test("a supplemental request token opens only its own request's document", async () => {
    const app = await seedApplicationWithTracker();
    const otherApp = await seedApplicationWithTracker();
    const own = await seedSupplementalRequest({ applicationId: app.applicationId });
    const sibling = await seedSupplementalRequest({ applicationId: app.applicationId });
    const elsewhere = await seedSupplementalRequest({ applicationId: otherApp.applicationId });

    const ownDoc = await doc("admission_document", { type: "request", id: own.requestId });
    const siblingDoc = await doc("admission_document", { type: "request", id: sibling.requestId });
    const elsewhereDoc = await doc("admission_document", { type: "request", id: elsewhere.requestId });

    assert.equal(await canRead(ownDoc, own.token), true);
    assert.equal(await canRead(siblingDoc, own.token), false, "same application, other request");
    assert.equal(await canRead(elsewhereDoc, own.token), false, "same school, other application");
  });

  test("a tracker token opens only its own application's documents", async () => {
    const app = await seedApplicationWithTracker();
    const otherApp = await seedApplicationWithTracker();
    const ownDoc = await doc("admission_document", { type: "application", id: app.applicationId });
    const otherDoc = await doc("admission_document", { type: "application", id: otherApp.applicationId });
    assert.equal(await canRead(ownDoc, app.token), true);
    assert.equal(await canRead(otherDoc, app.token), false);
  });
});

describe("tokens never cross schools", () => {
  test("a school B token cannot open a school A document, even with a matching request id", async () => {
    const foreignStudent = await seedStudent({ schoolId: SCHOOL_B });
    const foreign = await seedParentDocumentRequest({ studentId: foreignStudent });
    const forged = await doc("parent_document", { type: "request", id: foreign.requestId }, SCHOOL_A);
    assert.equal(await canRead(forged, foreign.token), false);

    const foreignApp = await seedApplicationWithTracker({ schoolId: SCHOOL_B });
    const foreignSupp = await seedSupplementalRequest({ applicationId: foreignApp.applicationId });
    const forgedApp = await doc("admission_document", { type: "application", id: foreignApp.applicationId }, SCHOOL_A);
    const forgedSupp = await doc("admission_document", { type: "request", id: foreignSupp.requestId }, SCHOOL_A);
    assert.equal(await canRead(forgedApp, foreignApp.token), false);
    assert.equal(await canRead(forgedSupp, foreignSupp.token), false);

    const realForeign = await doc("parent_document", { type: "request", id: foreign.requestId }, SCHOOL_B);
    assert.equal(await canRead(realForeign, foreign.token), true);
  });
});

describe("token types stay separate", () => {
  test("each token only satisfies its own store", async () => {
    const student = await seedStudent();
    const parent = await seedParentDocumentRequest({ studentId: student });
    const app = await seedApplicationWithTracker();
    const supp = await seedSupplementalRequest({ applicationId: app.applicationId });

    const parentDoc = await doc("parent_document", { type: "request", id: parent.requestId });
    const suppDoc = await doc("admission_document", { type: "request", id: supp.requestId });
    const appDoc = await doc("admission_document", { type: "application", id: app.applicationId });

    assert.equal(await canRead(parentDoc, app.token), false, "tracker on parent request");
    assert.equal(await canRead(parentDoc, supp.token), false, "supplemental on parent request");
    assert.equal(await canRead(suppDoc, parent.token), false, "parent on supplemental request");
    assert.equal(await canRead(suppDoc, app.token), false, "tracker on supplemental request");
    assert.equal(await canRead(appDoc, parent.token), false, "parent on application");
    assert.equal(await canRead(appDoc, supp.token), false, "supplemental on application");

    // Kind and association must agree with the token store.
    const parentAsAdmission = await doc("admission_document", { type: "request", id: parent.requestId });
    const suppAsParent = await doc("parent_document", { type: "request", id: supp.requestId });
    const appAsParent = await doc("parent_document", { type: "application", id: app.applicationId });
    assert.equal(await canRead(parentAsAdmission, parent.token), false);
    assert.equal(await canRead(suppAsParent, supp.token), false);
    assert.equal(await canRead(appAsParent, app.token), false);
  });

  test("other kinds and student photos never open with any token", async () => {
    const student = await seedStudent();
    const parent = await seedParentDocumentRequest({ studentId: student });
    for (const kind of ["student_avatar", "student_record_document", "teacher_document", "expense_receipt"]) {
      const assetId = await seedAsset({ kind, association: { type: "request", id: parent.requestId } });
      assert.equal(await canRead(assetId, parent.token), false, kind);
    }
  });
});

describe("missing, revoked, and malformed tokens", () => {
  test("are all rejected", async () => {
    const student = await seedStudent();
    const parent = await seedParentDocumentRequest({ studentId: student });
    const parentDoc = await doc("parent_document", { type: "request", id: parent.requestId });

    for (const bad of ["", "   ", "short", "x".repeat(129), `${parent.token}x`, parent.token.toUpperCase()]) {
      assert.equal(await canRead(parentDoc, bad), false, JSON.stringify(bad.slice(0, 20)));
    }
    assert.equal(await canRead(parentDoc, `  ${parent.token}  `), true, "surrounding whitespace is trimmed");

    await mongoose
      .model("Student")
      .collection.updateOne({ _id: student }, { $pull: { parentDocumentRequests: { _id: parent.requestId } } } as never);
    assert.equal(await canRead(parentDoc, parent.token), false, "revoked request");

    const app = await seedApplicationWithTracker();
    const appDoc = await doc("admission_document", { type: "application", id: app.applicationId });
    await mongoose.model("AdmissionApplication").collection.deleteOne({ _id: app.applicationId });
    assert.equal(await canRead(appDoc, app.token), false, "deleted application");
  });

  test("a signed-in reader gains nothing from someone else's token", async () => {
    const student = await seedStudent();
    const own = await seedParentDocumentRequest({ studentId: student });
    const other = await seedParentDocumentRequest({ studentId: await seedStudent() });
    const otherDoc = await doc("parent_document", { type: "request", id: other.requestId });
    assert.equal(await canRead(otherDoc, own.token, actor({ roles: ["teacher"] })), false);
  });
});

describe("public-token uploaders can only finalize their own kind of anonymous upload", () => {
  async function pendingUpload(input: {
    kind: "admission_document" | "parent_document";
    uploadedByUserId?: Types.ObjectId | null;
    association?: { type: string; id: Types.ObjectId } | null;
  }) {
    const id = await seedAsset({
      kind: input.kind,
      mimeType: PDF,
      status: "pending",
      uploadedByUserId: input.uploadedByUserId ?? null,
      association: input.association ?? null,
    });
    const stored = await mongoose.model("StoredAsset").collection.findOne({ _id: id });
    r2.objects.set(String(stored!.storageKey), {
      body: new Uint8Array(12),
      contentType: PDF,
      etag: '"etag"',
    });
    return String(id);
  }

  test("policy: kind, uploader, and association are all enforced", async () => {
    const student = await seedStudent();
    const parent = await seedParentDocumentRequest({ studentId: student });
    const { actor: tokenActor } = await publicToken.resolvePublicUploadActor({
      studentParentDocumentToken: parent.token,
    });
    assert.equal(tokenActor.publicTokenKind, "parent_document");

    const base = { schoolId: SCHOOL_A, uploadedByUserId: null, association: null };
    assert.equal(policy.canMutateStoredAsset({ asset: { ...base, kind: "parent_document" }, actor: tokenActor }), true);
    assert.equal(policy.canMutateStoredAsset({ asset: { ...base, kind: "admission_document" }, actor: tokenActor }), false);
    assert.equal(
      policy.canMutateStoredAsset({
        asset: { ...base, kind: "parent_document", uploadedByUserId: new Types.ObjectId() },
        actor: tokenActor,
      }),
      false
    );
    assert.equal(
      policy.canMutateStoredAsset({
        asset: { ...base, kind: "parent_document", association: { type: "request", id: parent.requestId } },
        actor: tokenActor,
      }),
      false
    );
    assert.equal(
      policy.canMutateStoredAsset({ asset: { ...base, kind: "parent_document", schoolId: SCHOOL_B }, actor: tokenActor }),
      false
    );
  });

  test("the public complete route finalizes an own-kind anonymous upload only", async () => {
    const student = await seedStudent();
    const parent = await seedParentDocumentRequest({ studentId: student });
    const complete = (assetId: string) =>
      completeRoute(
        new Request("http://localhost/api/storage/public/uploads/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assetId, studentParentDocumentToken: parent.token }),
        })
      );

    const mine = await pendingUpload({ kind: "parent_document" });
    const res = await complete(mine);
    assert.equal(res.status, 200, await res.clone().text());

    const signedInUpload = await pendingUpload({ kind: "parent_document", uploadedByUserId: new Types.ObjectId() });
    const linked = await pendingUpload({
      kind: "parent_document",
      association: { type: "request", id: parent.requestId },
    });
    const otherKind = await pendingUpload({ kind: "admission_document" });
    for (const assetId of [signedInUpload, linked, otherKind]) {
      const denied = await complete(assetId);
      assert.equal(denied.status, 403, assetId);
      const stored = await mongoose.model("StoredAsset").collection.findOne({ _id: new Types.ObjectId(assetId) });
      assert.equal(stored?.status, "pending");
    }
  });
});

describe("gateway responses do not reveal whether a document exists", () => {
  test("anonymous missing, wrong-token, no-token, and malformed ids look identical", async () => {
    const student = await seedStudent();
    const own = await seedParentDocumentRequest({ studentId: student });
    const other = await seedParentDocumentRequest({ studentId: await seedStudent() });
    const otherDoc = String(await doc("parent_document", { type: "request", id: other.requestId }));
    const pendingDoc = String(
      await seedAsset({ kind: "parent_document", mimeType: PDF, status: "pending", association: { type: "request", id: own.requestId } })
    );

    const responses = [
      await gateway(String(new Types.ObjectId()), own.token),
      await gateway(String(new Types.ObjectId())),
      await gateway(otherDoc, own.token),
      await gateway(otherDoc),
      await gateway(pendingDoc, own.token),
      await gateway("not-an-object-id", own.token),
    ];
    const shapes = await Promise.all(
      responses.map(async (res) => ({
        status: res.status,
        location: res.headers.get("location"),
        body: await res.text(),
      }))
    );
    for (const shape of shapes) {
      assert.deepEqual(shape, shapes[0]);
    }
    assert.equal(shapes[0].status, 401);
    assert.equal(shapes[0].location, null);
    assert.deepEqual(JSON.parse(shapes[0].body), { success: false, error: "Not allowed to download this file" });
  });

  test("the legitimate token still redirects", async () => {
    const student = await seedStudent();
    const own = await seedParentDocumentRequest({ studentId: student });
    const ownDoc = String(await doc("parent_document", { type: "request", id: own.requestId }));
    const res = await gateway(ownDoc, own.token);
    assert.equal(res.status, 302);
    assert.ok(res.headers.get("location")?.startsWith("https://r2.test/presign-get/"));
  });

  test("signed-in callers keep the 404 and 403 contract", async () => {
    const other = await seedParentDocumentRequest({ studentId: await seedStudent() });
    const otherDoc = String(await doc("parent_document", { type: "request", id: other.requestId }));
    setActiveSchool({
      ok: true,
      context: { userId: new Types.ObjectId(), schoolId: SCHOOL_A, roles: ["teacher"], source: "single_membership" },
    });
    assert.equal((await gateway(String(new Types.ObjectId()))).status, 404);
    assert.equal((await gateway(otherDoc)).status, 403);
    await assert.rejects(
      () => service.grantAssetDownload({ actor: actor(), assetId: String(new Types.ObjectId()), r2 }),
      /not found/i
    );
  });
});
