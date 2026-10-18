import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { stubServerOnly } from "../regression/helpers/stub-server-only";
import type { StorageActor } from "@/lib/storage/types";

stubServerOnly();

const DB_NAME = "p112a_admin_integration";
let mongod: MongoMemoryServer;

before(
  async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri(), { dbName: DB_NAME });
    const [{ ScriptSubmission }, { EmailMessage }, { TeacherAttendance }] = await Promise.all([
      import("@/models/ScriptSubmission"),
      import("@/models/EmailMessage"),
      import("@/models/TeacherAttendance"),
    ]);
    await Promise.all([
      ScriptSubmission.createIndexes(),
      EmailMessage.createIndexes(),
      TeacherAttendance.createIndexes(),
    ]);
  },
  { timeout: 180_000 }
);

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  for (const collection of (await mongoose.connection.db?.collections()) ?? []) {
    await collection.deleteMany({});
  }
});

function script(overrides: Record<string, unknown> = {}) {
  const userId = new Types.ObjectId();
  return {
    schoolId: new Types.ObjectId(),
    examPaperId: new Types.ObjectId(),
    studentId: new Types.ObjectId(),
    submittedByUserId: userId,
    status: "awaiting_uploads",
    idempotencyKey: `script-${new Types.ObjectId()}`,
    pages: [],
    auditEvents: [{ type: "created", actorUserId: userId, pageId: null }],
    ...overrides,
  };
}

function email(overrides: Record<string, unknown> = {}) {
  return {
    provider: "resend",
    direction: "outbound",
    mailboxScope: "school",
    mailboxKey: "school_ops",
    schoolId: new Types.ObjectId(),
    from: "school@example.test",
    to: "guardian@example.test",
    subject: "Test reply",
    status: "queued",
    messageClass: "manual",
    trafficClass: "manual",
    ...overrides,
  };
}

describe("P1.12A Administrator schema and index integration", () => {
  test("creates the scanner and email idempotency indexes", async () => {
    const [{ ScriptSubmission }, { EmailMessage }] = await Promise.all([
      import("@/models/ScriptSubmission"),
      import("@/models/EmailMessage"),
    ]);
    const scannerIndexes = await ScriptSubmission.collection.indexes();
    const emailIndexes = await EmailMessage.collection.indexes();
    assert.ok(scannerIndexes.some((index) => index.name === "unique_script_submission_idempotency" && index.unique));
    assert.ok(emailIndexes.some((index) => index.name === "unique_school_email_idempotency" && index.unique));
  });

  test("the dry-run inspector finds missing indexes and apply restores only those targets", async () => {
    const [{ ScriptSubmission }, { EmailMessage }, indexScript] = await Promise.all([
      import("@/models/ScriptSubmission"),
      import("@/models/EmailMessage"),
      import("../../scripts/ensure-konect-admin-indexes"),
    ]);
    await ScriptSubmission.collection.dropIndexes();
    await EmailMessage.collection.dropIndex("unique_school_email_idempotency");
    const inspection = await indexScript.inspectAdministratorIndexes();
    assert.equal(inspection.blocked, false);
    assert.equal(inspection.targets.filter((target) => target.status === "missing").length, 4);
    const applied = await indexScript.applyAdministratorIndexes();
    assert.equal(applied.applied, true);
    assert.equal(applied.created.length, 4);
    const repeated = await indexScript.applyAdministratorIndexes();
    assert.equal(repeated.applied, true);
    assert.deepEqual(repeated.created, []);
  });

  test("enforces scanner idempotency per school and allows the same key in another school", async () => {
    const { ScriptSubmission } = await import("@/models/ScriptSubmission");
    const schoolId = new Types.ObjectId();
    const key = "scanner-operation-0001";
    await ScriptSubmission.create(script({ schoolId, idempotencyKey: key }));
    await assert.rejects(
      () => ScriptSubmission.create(script({ schoolId, idempotencyKey: key })),
      (error: unknown) => (error as { code?: number }).code === 11000
    );
    await assert.doesNotReject(() =>
      ScriptSubmission.create(script({ schoolId: new Types.ObjectId(), idempotencyKey: key }))
    );
  });

  test("enforces durable email idempotency without blocking messages that have no key", async () => {
    const { EmailMessage } = await import("@/models/EmailMessage");
    const schoolId = new Types.ObjectId();
    const key = "reply-operation-0001";
    await EmailMessage.create(email({ schoolId, idempotencyKey: key }));
    await assert.rejects(
      () => EmailMessage.create(email({ schoolId, idempotencyKey: key })),
      (error: unknown) => (error as { code?: number }).code === 11000
    );
    await assert.doesNotReject(() =>
      EmailMessage.create(email({ schoolId: new Types.ObjectId(), idempotencyKey: key }))
    );
    await assert.doesNotReject(() => EmailMessage.create([email({ schoolId }), email({ schoolId })]));
  });
});

describe("P1.12A scanner persistence and ownership", () => {
  test("concurrent page initialization retires only the losing asset and preserves siblings", async () => {
    const [{ ScriptSubmission }, { StoredAsset }, { initializePage }] = await Promise.all([
      import("@/models/ScriptSubmission"),
      import("@/models/StoredAsset"),
      import("@/lib/konect/script-submission-service"),
    ]);
    const schoolId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const submission = await ScriptSubmission.create(script({ schoolId, submittedByUserId: userId }));
    const siblingAsset = await StoredAsset.create({
      schoolId,
      ownerUserId: userId,
      uploadedByUserId: userId,
      provider: "r2",
      storageKey: `assess/${new Types.ObjectId()}.jpg`,
      fileName: "sibling.jpg",
      extension: "jpg",
      mimeType: "image/jpeg",
      sizeBytes: 0,
      kind: "assess_script_page",
      visibility: "private",
      status: "pending",
      association: { type: "scriptSubmission", id: submission._id },
    });
    await ScriptSubmission.updateOne(
      { _id: submission._id },
      { $push: { pages: {
        pageId: "sibling-page",
        assetId: siblingAsset._id,
        pageNumber: 1,
        mimeType: "image/jpeg",
        sizeBytes: null,
        status: "pending",
        createdAt: new Date(),
        completedAt: null,
      } } }
    );

    let presignCount = 0;
    const presignUploadFn = async () => {
      presignCount += 1;
      const asset = await StoredAsset.create({
        schoolId,
        ownerUserId: userId,
        uploadedByUserId: userId,
        provider: "r2",
        storageKey: `assess/${new Types.ObjectId()}.jpg`,
        fileName: "page.jpg",
        extension: "jpg",
        mimeType: "image/jpeg",
        sizeBytes: 0,
        kind: "assess_script_page",
        visibility: "private",
        status: "pending",
        association: { type: "scriptSubmission", id: submission._id },
      });
      await new Promise((resolve) => setTimeout(resolve, presignCount === 1 ? 10 : 0));
      return {
        assetId: String(asset._id),
        uploadUrl: `https://uploads.test/${asset._id}`,
        headers: {},
        expiresInSeconds: 60,
        assetUrl: `https://assets.test/${asset._id}`,
      };
    };
    const dependencies = {
      presignUploadFn,
      enforceKindUploadPolicyFn: async () => undefined,
    };
    const first = await ScriptSubmission.findById(submission._id);
    const second = await ScriptSubmission.findById(submission._id);
    assert.ok(first && second);

    const outcomes = await Promise.allSettled([
      initializePage({ submission: first, userId, fileName: "page.jpg", mimeType: "image/jpeg", pageNumber: 2 }, dependencies),
      initializePage({ submission: second, userId, fileName: "page.jpg", mimeType: "image/jpeg", pageNumber: 2 }, dependencies),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);

    const stored = await ScriptSubmission.findById(submission._id).lean();
    assert.equal(stored?.pages.length, 2);
    const assets = await StoredAsset.find({ schoolId, "association.id": submission._id }).lean();
    assert.equal(assets.filter((asset) => asset.status === "pending").length, 2);
    assert.equal(assets.filter((asset) => asset.status === "deleted").length, 1);
    assert.equal((await StoredAsset.findById(siblingAsset._id).lean())?.status, "pending");
  });

  test("asset retirement remains school and submission scoped", async () => {
    const [{ ScriptSubmission }, { StoredAsset }, { retireSubmissionAsset }] = await Promise.all([
      import("@/models/ScriptSubmission"),
      import("@/models/StoredAsset"),
      import("@/lib/konect/script-submission-service"),
    ]);
    const schoolId = new Types.ObjectId();
    const otherSchoolId = new Types.ObjectId();
    const submission = await ScriptSubmission.create(script({ schoolId }));
    const asset = await StoredAsset.create({
      schoolId,
      ownerUserId: submission.submittedByUserId,
      uploadedByUserId: submission.submittedByUserId,
      provider: "r2",
      storageKey: `assess/${new Types.ObjectId()}.jpg`,
      fileName: "page.jpg",
      extension: "jpg",
      mimeType: "image/jpeg",
      sizeBytes: 0,
      kind: "assess_script_page",
      visibility: "private",
      status: "pending",
      association: { type: "scriptSubmission", id: submission._id },
    });
    await retireSubmissionAsset(otherSchoolId, submission._id, asset._id);
    assert.equal((await StoredAsset.findById(asset._id).lean())?.status, "pending");
    await retireSubmissionAsset(schoolId, submission._id, asset._id);
    assert.equal((await StoredAsset.findById(asset._id).lean())?.status, "deleted");
  });

  test("failed presigning marks the owned asset failed instead of leaving it pending", async () => {
    const [{ ScriptSubmission }, { StoredAsset }, { presignUpload }] = await Promise.all([
      import("@/models/ScriptSubmission"),
      import("@/models/StoredAsset"),
      import("@/lib/storage/service"),
    ]);
    const schoolId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const submission = await ScriptSubmission.create(script({ schoolId, submittedByUserId: userId }));
    const actor = { userId, schoolId, roles: ["school_admin"] as StorageActor["roles"] };

    await assert.rejects(() => presignUpload({
      actor,
      kind: "assess_script_page",
      fileName: "page.jpg",
      mimeType: "image/jpeg",
      association: { type: "scriptSubmission", id: String(submission._id) },
      r2: {
        createPresignedPut: async () => { throw new Error("provider unavailable"); },
      } as never,
    }));

    const failed = await StoredAsset.findOne({ schoolId, "association.id": submission._id }).lean();
    assert.equal(failed?.status, "failed");
    assert.equal(failed?.failureCode, "presign_failed");
  });

  test("denies another administrator and another school the submission", async () => {
    const { ScriptSubmission } = await import("@/models/ScriptSubmission");
    const { ownSubmission } = await import("@/lib/konect/script-submission-service");
    const ownerId = new Types.ObjectId();
    const schoolId = new Types.ObjectId();
    const row = await ScriptSubmission.create(script({ schoolId, submittedByUserId: ownerId }));

    assert.equal(String((await ownSubmission(String(row._id), schoolId, ownerId))._id), String(row._id));
    await assert.rejects(
      () => ownSubmission(String(row._id), schoolId, new Types.ObjectId()),
      (error: unknown) => error instanceof Response && error.status === 404
    );
    await assert.rejects(
      () => ownSubmission(String(row._id), new Types.ObjectId(), ownerId),
      (error: unknown) => error instanceof Response && error.status === 404
    );
  });

  test("finalizes once under concurrency and cannot be cancelled afterward", async () => {
    const { ScriptSubmission } = await import("@/models/ScriptSubmission");
    const { cancelSubmission, finalizeSubmission } = await import("@/lib/konect/script-submission-service");
    const ownerId = new Types.ObjectId();
    const pageId = "page-one";
    const created = await ScriptSubmission.create(
      script({
        submittedByUserId: ownerId,
        pages: [{
          pageId,
          assetId: new Types.ObjectId(),
          pageNumber: 1,
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          status: "ready",
          createdAt: new Date(),
          completedAt: new Date(),
        }],
      })
    );
    const first = await ScriptSubmission.findById(created._id);
    const second = await ScriptSubmission.findById(created._id);
    assert.ok(first && second);
    const finalized = await Promise.all([
      finalizeSubmission({ submission: first, userId: ownerId }),
      finalizeSubmission({ submission: second, userId: ownerId }),
    ]);
    assert.deepEqual(finalized.map((row) => row.status), ["received", "received"]);
    const stored = await ScriptSubmission.findById(created._id).lean();
    assert.equal(stored?.status, "received");
    assert.equal(stored?.auditEvents.filter((event) => event.type === "finalized").length, 1);
    await assert.rejects(
      () => cancelSubmission({ submission: finalized[0], userId: ownerId }),
      (error: unknown) => error instanceof Response && error.status === 409
    );
  });

  test("expires only abandoned drafts and leaves received submissions intact", async () => {
    const { ScriptSubmission } = await import("@/models/ScriptSubmission");
    const { expireAbandonedSubmissions, SCRIPT_DRAFT_RETENTION_MS } = await import(
      "@/lib/konect/script-submission-service"
    );
    const now = new Date("2026-10-11T12:00:00.000Z");
    const old = new Date(now.getTime() - SCRIPT_DRAFT_RETENTION_MS - 1);
    const abandoned = await ScriptSubmission.create(script({ status: "awaiting_uploads" }));
    const received = await ScriptSubmission.create(script({ status: "received", finalizedAt: old }));
    const recent = await ScriptSubmission.create(script({ status: "awaiting_uploads" }));
    await ScriptSubmission.updateMany(
      { _id: { $in: [abandoned._id, received._id] } },
      { $set: { updatedAt: old } },
      { timestamps: false }
    );
    await expireAbandonedSubmissions(now);
    const [expiredRow, receivedRow, recentRow] = await Promise.all([
      ScriptSubmission.findById(abandoned._id).lean(),
      ScriptSubmission.findById(received._id).lean(),
      ScriptSubmission.findById(recent._id).lean(),
    ]);
    assert.equal(expiredRow?.status, "cancelled");
    assert.equal(receivedRow?.status, "received");
    assert.equal(recentRow?.status, "awaiting_uploads");
  });
});

describe("P1.12A Assess page storage isolation", () => {
  test("treats an erroneously public script page as private and owner-only", async () => {
    const policy = await import("@/lib/storage/access-policy");
    const schoolId = new Types.ObjectId();
    const ownerId = new Types.ObjectId();
    const asset = {
      status: "ready",
      visibility: "public",
      kind: "assess_script_page" as const,
      schoolId,
      uploadedByUserId: ownerId,
      association: { type: "scriptSubmission", id: new Types.ObjectId() },
    };
    const actor = (userId: Types.ObjectId, actorSchoolId = schoolId) => ({
      userId,
      schoolId: actorSchoolId,
      roles: ["school_admin"] as StorageActor["roles"],
    });
    assert.equal(policy.isEffectivelyPublic(asset), false);
    assert.equal((await policy.authorizeStoredAssetRead({ asset, actor: null })).allowed, false);
    assert.equal((await policy.authorizeStoredAssetRead({ asset, actor: actor(ownerId) })).allowed, true);
    assert.equal((await policy.authorizeStoredAssetRead({ asset, actor: actor(new Types.ObjectId()) })).allowed, false);
    assert.equal((await policy.authorizeStoredAssetRead({ asset, actor: actor(ownerId, new Types.ObjectId()) })).allowed, false);
    assert.equal(policy.canMutateStoredAsset({ asset, actor: actor(ownerId) }), true);
    assert.equal(policy.canMutateStoredAsset({ asset, actor: actor(new Types.ObjectId()) }), false);
  });
});
