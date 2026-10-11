import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { Types } from "mongoose";
import { stubServerOnly } from "../regression/helpers/stub-server-only";
import {
  SCHOOL_A,
  SCHOOL_B,
  actor,
  assetPath,
  resetStorageDb,
  seedAsset,
  seedApplicationWithTracker,
  seedAssignment,
  seedClassGroup,
  seedDelegation,
  seedGuardian,
  seedParentDocumentRequest,
  seedStudent,
  seedTeacher,
  setStudentPhoto,
  startStorageDb,
  stopStorageDb,
} from "./helpers/school-fixtures";
import type { StorageActor } from "@/lib/storage/types";

stubServerOnly();

let policy: typeof import("@/lib/storage/access-policy");

before(
  async () => {
    await startStorageDb("student_avatar_access");
    policy = await import("@/lib/storage/access-policy");
  },
  { timeout: 180_000 }
);

after(stopStorageDb);
beforeEach(resetStorageDb);

type Shape = { visibility: "public" | "private"; linked: boolean };
const SHAPES: Shape[] = [
  { visibility: "public", linked: true },
  { visibility: "public", linked: false },
  { visibility: "private", linked: true },
  { visibility: "private", linked: false },
];

function label(shape: Shape) {
  return `${shape.visibility}, ${shape.linked ? "linked" : "legacy unlinked"}`;
}

/** A student in a class with a photo of the given shape. */
async function studentWithPhoto(shape: Shape, schoolId = SCHOOL_A) {
  const classGroupId = await seedClassGroup({ schoolId });
  const studentId = await seedStudent({ schoolId, classGroupId });
  const assetId = await seedAsset({
    schoolId,
    visibility: shape.visibility,
    association: shape.linked ? { type: "student", id: studentId } : null,
  });
  await setStudentPhoto(studentId, assetPath(assetId));
  return { classGroupId, studentId, assetId };
}

async function canRead(
  assetId: Types.ObjectId,
  reader: StorageActor | null,
  accessToken?: string
) {
  const { StoredAsset } = await import("@/models/StoredAsset");
  const asset = await StoredAsset.findById(assetId);
  assert.ok(asset);
  const decision = await policy.authorizeStoredAssetRead({ asset, actor: reader, accessToken });
  return decision.allowed;
}

describe("student photo read rule", () => {
  for (const shape of SHAPES) {
    describe(label(shape), () => {
      test("same-school admin and assisted access are allowed", async () => {
        const { assetId } = await studentWithPhoto(shape);
        assert.equal(await canRead(assetId, actor({ roles: ["school_admin"] })), true);
        assert.equal(await canRead(assetId, actor({ roles: ["school_admin"], isPlatformOperator: true })), true);
      });

      test("bursar and students.view delegate are allowed", async () => {
        const { assetId } = await studentWithPhoto(shape);
        assert.equal(await canRead(assetId, actor({ roles: ["bursar"] })), true);
        const delegate = actor({ roles: ["staff"] });
        await seedDelegation({ staffUserId: delegate.userId!, permissions: ["students.view"] });
        assert.equal(await canRead(assetId, delegate), true);
      });

      test("homeroom teacher (both models) and assigned teacher are allowed", async () => {
        const { assetId, classGroupId } = await studentWithPhoto(shape);

        const byTeacherField = actor({ roles: ["teacher"] });
        await seedTeacher({ userId: byTeacherField.userId!, homeroomClassGroupId: classGroupId });
        assert.equal(await canRead(assetId, byTeacherField), true);

        const byClassField = actor({ roles: ["teacher"] });
        const teacherId = await seedTeacher({ userId: byClassField.userId! });
        const { ClassGroup } = await import("@/models/ClassGroup");
        await ClassGroup.collection.updateOne({ _id: classGroupId }, { $set: { homeroomTeacherId: teacherId } });
        assert.equal(await canRead(assetId, byClassField), true);

        const assigned = actor({ roles: ["teacher"] });
        const assignedTeacherId = await seedTeacher({ userId: assigned.userId! });
        await seedAssignment({ teacherId: assignedTeacherId, classGroupId });
        assert.equal(await canRead(assetId, assigned), true);
      });

      test("guardian is allowed", async () => {
        const { assetId, studentId } = await studentWithPhoto(shape);
        const parent = actor({ roles: ["parent"] });
        await seedGuardian({ userId: parent.userId!, studentId });
        assert.equal(await canRead(assetId, parent), true);
      });

      test("Learn student is allowed on their own photo only", async () => {
        const { assetId, studentId } = await studentWithPhoto(shape);
        const other = await studentWithPhoto(shape);
        const learner = actor({ userId: null, roles: [], learnStudentId: studentId });
        assert.equal(await canRead(assetId, learner), true);
        assert.equal(await canRead(other.assetId, learner), false);
      });

      test("unauthenticated and cross-school readers are denied", async () => {
        const { assetId } = await studentWithPhoto(shape);
        assert.equal(await canRead(assetId, null), false);
        assert.equal(await canRead(assetId, actor({ schoolId: SCHOOL_B, roles: ["school_admin"] })), false);
        assert.equal(
          await canRead(assetId, actor({ schoolId: SCHOOL_B, roles: ["school_admin"], isPlatformOperator: true })),
          false
        );
      });

      test("unrelated teacher and inactive assignment are denied", async () => {
        const { assetId, classGroupId } = await studentWithPhoto(shape);
        const unrelated = actor({ roles: ["teacher"] });
        await seedTeacher({ userId: unrelated.userId!, homeroomClassGroupId: await seedClassGroup() });
        assert.equal(await canRead(assetId, unrelated), false);

        const inactive = actor({ roles: ["teacher"] });
        const teacherId = await seedTeacher({ userId: inactive.userId! });
        await seedAssignment({ teacherId, classGroupId, status: "inactive" });
        assert.equal(await canRead(assetId, inactive), false);
      });

      test("non-guardian parent and undelegated staff are denied", async () => {
        const { assetId } = await studentWithPhoto(shape);
        const parent = actor({ roles: ["parent"] });
        await seedGuardian({ userId: parent.userId!, studentId: await seedStudent() });
        assert.equal(await canRead(assetId, parent), false);
        assert.equal(await canRead(assetId, actor({ roles: ["staff"] })), false);
        const editorOnly = actor({ roles: ["staff"] });
        await seedDelegation({ staffUserId: editorOnly.userId!, permissions: ["finance.view"] });
        assert.equal(await canRead(assetId, editorOnly), false);
      });

      test("the uploader alone is denied", async () => {
        const uploader = actor({ roles: ["staff"] });
        const studentId = await seedStudent({ classGroupId: await seedClassGroup() });
        const assetId = await seedAsset({
          visibility: shape.visibility,
          association: shape.linked ? { type: "student", id: studentId } : null,
          uploadedByUserId: uploader.userId,
        });
        await setStudentPhoto(studentId, assetPath(assetId));
        assert.equal(await canRead(assetId, uploader), false);
      });
    });
  }

  test("Learn student cannot read a non-avatar asset", async () => {
    const studentId = await seedStudent();
    const assetId = await seedAsset({
      kind: "student_record_document",
      association: { type: "student", id: studentId },
    });
    const learner = actor({ userId: null, roles: [], learnStudentId: studentId });
    assert.equal(await canRead(assetId, learner), false);
  });

  test("ambiguous and unreferenced legacy photos are denied to non-admins", async () => {
    const classGroupId = await seedClassGroup();
    const first = await seedStudent({ classGroupId });
    const second = await seedStudent({ classGroupId });
    const shared = await seedAsset({ visibility: "public" });
    await setStudentPhoto(first, assetPath(shared));
    await setStudentPhoto(second, assetPath(shared));
    const orphan = await seedAsset({ visibility: "public" });

    const teacher = actor({ roles: ["teacher"] });
    await seedTeacher({ userId: teacher.userId!, homeroomClassGroupId: classGroupId });
    const parent = actor({ roles: ["parent"] });
    await seedGuardian({ userId: parent.userId!, studentId: first });

    for (const reader of [teacher, parent, actor({ roles: ["bursar"] })]) {
      assert.equal(await canRead(shared, reader), false);
      assert.equal(await canRead(orphan, reader), false);
    }
    assert.equal(await canRead(shared, actor({ roles: ["school_admin"] })), true);
    assert.equal(await canRead(orphan, actor({ roles: ["school_admin"] })), true);
  });

  test("a student in another school referencing the asset does not resolve ownership", async () => {
    const assetId = await seedAsset({ visibility: "public" });
    const foreign = await seedStudent({ schoolId: SCHOOL_B });
    await setStudentPhoto(foreign, assetPath(assetId));
    const learner = actor({ userId: null, roles: [], schoolId: SCHOOL_B, learnStudentId: foreign });
    assert.equal(await canRead(assetId, learner), false);
  });

  test("teacher avatars and school branding stay publicly readable", async () => {
    const teacherAvatar = await seedAsset({ kind: "teacher_avatar", visibility: "public" });
    const brand = await seedAsset({ kind: "school_brand_image", visibility: "public" });
    assert.equal(await canRead(teacherAvatar, null), true);
    assert.equal(await canRead(brand, null), true);
  });

  test("the sync check denies a student photo to a public token actor", async () => {
    const { StoredAsset } = await import("@/models/StoredAsset");
    const assetId = await seedAsset({ visibility: "public" });
    const asset = await StoredAsset.findById(assetId);
    assert.ok(asset);
    const tokenActor = actor({ userId: null, roles: [], isPublicToken: true });
    assert.equal(policy.canReadStoredAsset({ asset, actor: tokenActor }).allowed, false);
  });

  test("the sync check never treats a student photo as public", async () => {
    const { StoredAsset } = await import("@/models/StoredAsset");
    const assetId = await seedAsset({ visibility: "public" });
    const asset = await StoredAsset.findById(assetId);
    assert.ok(asset);
    assert.equal(policy.isEffectivelyPublic(asset), false);
    assert.equal(policy.canReadStoredAsset({ asset, actor: null }).allowed, false);
    assert.equal(
      policy.canReadStoredAsset({ asset, actor: actor({ roles: ["teacher"] }) }).allowed,
      false
    );
  });
});

describe("special link tokens cannot unlock student photos", () => {
  for (const visibility of ["public", "private"] as const) {
    test(`${visibility} photo associated to an application, with its tracker token`, async () => {
      const classGroupId = await seedClassGroup();
      const studentId = await seedStudent({ classGroupId });
      const { applicationId, token } = await seedApplicationWithTracker();
      const assetId = await seedAsset({
        visibility,
        association: { type: "application", id: applicationId },
      });
      await setStudentPhoto(studentId, assetPath(assetId));

      assert.equal(await canRead(assetId, null, token), false);
      const unrelated = actor({ roles: ["teacher"] });
      await seedTeacher({ userId: unrelated.userId!, homeroomClassGroupId: await seedClassGroup() });
      assert.equal(await canRead(assetId, unrelated, token), false);
      assert.equal(
        await canRead(assetId, actor({ userId: null, roles: [], isPublicToken: true }), token),
        false
      );

      // A non-student association leaves the owner unresolved: only admins read it.
      const parent = actor({ roles: ["parent"] });
      await seedGuardian({ userId: parent.userId!, studentId });
      assert.equal(await canRead(assetId, parent, token), false);
      assert.equal(await canRead(assetId, actor({ roles: ["school_admin"] }), token), true);
    });

    test(`${visibility} photo associated to a document request, with the request token`, async () => {
      const studentId = await seedStudent({ classGroupId: await seedClassGroup() });
      const { requestId, token } = await seedParentDocumentRequest({ studentId });
      const assetId = await seedAsset({
        visibility,
        association: { type: "request", id: requestId },
      });
      await setStudentPhoto(studentId, assetPath(assetId));

      assert.equal(await canRead(assetId, null, token), false);
      assert.equal(await canRead(assetId, actor({ roles: ["staff"] }), token), false);
    });

    test(`${visibility} unlinked legacy photo with any valid token`, async () => {
      const studentId = await seedStudent({ classGroupId: await seedClassGroup() });
      const tracker = await seedApplicationWithTracker();
      const request = await seedParentDocumentRequest({ studentId });
      const assetId = await seedAsset({ visibility });
      await setStudentPhoto(studentId, assetPath(assetId));

      for (const token of [tracker.token, request.token]) {
        assert.equal(await canRead(assetId, null, token), false);
        assert.equal(await canRead(assetId, actor({ roles: ["teacher"] }), token), false);
      }
    });
  }

  test("a Learn student keeps their own photo and gains nothing from a token", async () => {
    const studentId = await seedStudent({ classGroupId: await seedClassGroup() });
    const { applicationId, token } = await seedApplicationWithTracker();
    const own = await seedAsset({ association: { type: "student", id: studentId } });
    await setStudentPhoto(studentId, assetPath(own));
    const otherStudent = await seedStudent();
    const other = await seedAsset({ association: { type: "application", id: applicationId } });
    await setStudentPhoto(otherStudent, assetPath(other));

    const learner = actor({ userId: null, roles: [], learnStudentId: studentId });
    assert.equal(await canRead(own, learner, token), true);
    assert.equal(await canRead(other, learner, token), false);
  });

  test("admission and parent document token flows still work", async () => {
    const studentId = await seedStudent();
    const { applicationId, token: trackerToken } = await seedApplicationWithTracker();
    const { requestId, token: requestToken } = await seedParentDocumentRequest({ studentId });

    const admissionDoc = await seedAsset({
      kind: "admission_document",
      mimeType: "application/pdf",
      association: { type: "application", id: applicationId },
    });
    assert.equal(await canRead(admissionDoc, null, trackerToken), true);
    assert.equal(await canRead(admissionDoc, null, "not-the-right-token-at-all"), false);

    const parentDoc = await seedAsset({
      kind: "parent_document",
      mimeType: "application/pdf",
      association: { type: "request", id: requestId },
    });
    assert.equal(await canRead(parentDoc, null, requestToken), true);

    const misfiled = await seedAsset({
      kind: "parent_document",
      mimeType: "application/pdf",
      association: { type: "application", id: applicationId },
    });
    assert.equal(await canRead(misfiled, null, trackerToken), false);
  });

  test("tokens never unlock other private kinds", async () => {
    const { applicationId, token } = await seedApplicationWithTracker();
    for (const kind of ["student_record_document", "teacher_document", "expense_receipt"]) {
      const assetId = await seedAsset({
        kind,
        mimeType: "application/pdf",
        association: { type: "application", id: applicationId },
      });
      assert.equal(await canRead(assetId, null, token), false, kind);
    }
  });
});
