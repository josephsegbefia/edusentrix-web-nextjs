import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import {
  SCHOOL_A,
  SCHOOL_B,
  actor,
  assetPath,
  resetStorageDb,
  seedAsset,
  seedDelegation,
  seedStudent,
  setStudentPhoto,
  startStorageDb,
  stopStorageDb,
} from "./helpers/school-fixtures";
import { stubStorageRouteDeps } from "./helpers/stub-storage-route-deps";

stubStorageRouteDeps();

let http: typeof import("@/lib/storage/http");
let photo: typeof import("@/lib/storage/student-photo");

before(
  async () => {
    await startStorageDb("student_photo_upload");
    http = await import("@/lib/storage/http");
    photo = await import("@/lib/storage/student-photo");
  },
  { timeout: 180_000 }
);

after(stopStorageDb);
beforeEach(resetStorageDb);

function forStudent(id: Types.ObjectId) {
  return { type: "student" as const, id: String(id) };
}

async function assetDoc(id: Types.ObjectId) {
  return mongoose.model("StoredAsset").collection.findOne({ _id: id });
}

describe("presign policy for student_avatar", () => {
  test("admins and assisted access may upload with or without a same-school student", async () => {
    const studentId = await seedStudent();
    const admin = actor({ roles: ["school_admin"] });
    await http.enforceKindUploadPolicy(admin, "student_avatar");
    await http.enforceKindUploadPolicy(admin, "student_avatar", forStudent(studentId));
    const assisted = actor({ roles: ["school_admin"], isPlatformOperator: true });
    await http.enforceKindUploadPolicy(assisted, "student_avatar", forStudent(studentId));
  });

  test("another school's student and a nonexistent student are rejected", async () => {
    const admin = actor({ roles: ["school_admin"] });
    const foreign = await seedStudent({ schoolId: SCHOOL_B });
    await assert.rejects(
      http.enforceKindUploadPolicy(admin, "student_avatar", forStudent(foreign)),
      { name: "StorageAuthorizationError" }
    );
    await assert.rejects(
      http.enforceKindUploadPolicy(admin, "student_avatar", forStudent(new Types.ObjectId())),
      { name: "StorageAuthorizationError" }
    );
  });

  test("a non-student association is rejected", async () => {
    const admin = actor({ roles: ["school_admin"] });
    await assert.rejects(
      http.enforceKindUploadPolicy(admin, "student_avatar", { type: "teacher", id: String(new Types.ObjectId()) }),
      { name: "StorageValidationError" }
    );
  });

  test("teacher, parent and bursar actors are rejected", async () => {
    const studentId = await seedStudent();
    for (const roles of [["teacher"], ["parent"], ["bursar"]] as const) {
      await assert.rejects(
        http.enforceKindUploadPolicy(actor({ roles: [...roles] }), "student_avatar", forStudent(studentId)),
        { name: "StorageAuthorizationError" }
      );
    }
  });

  test("a students.edit delegate needs a student association", async () => {
    const studentId = await seedStudent();
    const delegate = actor({ roles: ["staff"] });
    await seedDelegation({ staffUserId: delegate.userId!, permissions: ["students.view", "students.edit"] });
    await assert.rejects(http.enforceKindUploadPolicy(delegate, "student_avatar"), {
      name: "StorageAuthorizationError",
    });
    await http.enforceKindUploadPolicy(delegate, "student_avatar", forStudent(studentId));

    const viewer = actor({ roles: ["staff"] });
    await seedDelegation({ staffUserId: viewer.userId!, permissions: ["students.view"] });
    await assert.rejects(
      http.enforceKindUploadPolicy(viewer, "student_avatar", forStudent(studentId)),
      { name: "StorageAuthorizationError" }
    );
  });

  test("other kinds keep their existing policy", async () => {
    await http.enforceKindUploadPolicy(actor({ roles: ["teacher"] }), "teacher_avatar");
  });
});

describe("assigning a student photo", () => {
  test("links an unlinked asset and returns the canonical path", async () => {
    const studentId = await seedStudent();
    const assetId = await seedAsset();
    const result = await photo.assertAssignableStudentPhoto({
      schoolId: SCHOOL_A,
      studentId,
      photoUrl: `https://app.example.test${assetPath(assetId)}?disposition=inline`,
      currentPhotoUrl: null,
    });
    assert.equal(result.photoUrl, assetPath(assetId));
    const doc = await assetDoc(assetId);
    assert.equal(doc?.association?.type, "student");
    assert.equal(String(doc?.association?.id), String(studentId));
  });

  test("rejects another student's, another school's, wrong-kind and not-ready assets", async () => {
    const studentId = await seedStudent();
    const otherStudent = await seedStudent();
    const linkedElsewhere = await seedAsset({ association: { type: "student", id: otherStudent } });
    const referencedElsewhere = await seedAsset();
    await setStudentPhoto(otherStudent, assetPath(referencedElsewhere));
    const foreign = await seedAsset({ schoolId: SCHOOL_B });
    const wrongKind = await seedAsset({ kind: "teacher_avatar", visibility: "public" });
    const pending = await seedAsset({ status: "pending" });

    for (const assetId of [linkedElsewhere, referencedElsewhere, foreign, wrongKind, pending]) {
      await assert.rejects(
        photo.assertAssignableStudentPhoto({
          schoolId: SCHOOL_A,
          studentId,
          photoUrl: assetPath(assetId),
          currentPhotoUrl: null,
        }),
        { name: "StorageValidationError" }
      );
    }
    const untouched = await assetDoc(referencedElsewhere);
    assert.equal(untouched?.association, null);
  });

  test("rejects new external and data URLs, accepts an unchanged legacy value, clears on blank", async () => {
    const studentId = await seedStudent({ photoUrl: "https://legacy.example.test/photo.jpg" });
    for (const value of ["https://evil.example.test/x.jpg", "data:image/png;base64,AAAA"]) {
      await assert.rejects(
        photo.assertAssignableStudentPhoto({
          schoolId: SCHOOL_A,
          studentId,
          photoUrl: value,
          currentPhotoUrl: "https://legacy.example.test/photo.jpg",
        }),
        { name: "StorageValidationError" }
      );
    }
    const unchanged = await photo.assertAssignableStudentPhoto({
      schoolId: SCHOOL_A,
      studentId,
      photoUrl: "https://legacy.example.test/photo.jpg",
      currentPhotoUrl: "https://legacy.example.test/photo.jpg",
    });
    assert.equal(unchanged.photoUrl, "https://legacy.example.test/photo.jpg");
    const cleared = await photo.assertAssignableStudentPhoto({
      schoolId: SCHOOL_A,
      studentId,
      photoUrl: "  ",
      currentPhotoUrl: "https://legacy.example.test/photo.jpg",
    });
    assert.equal(cleared.photoUrl, null);
  });

  test("create flow defers the link until the student exists", async () => {
    const assetId = await seedAsset();
    const result = await photo.assertAssignableStudentPhoto({
      schoolId: SCHOOL_A,
      studentId: null,
      photoUrl: assetPath(assetId),
    });
    assert.equal(result.pendingLinkAssetId, String(assetId));
    assert.equal((await assetDoc(assetId))?.association, null);
    const studentId = await seedStudent({ photoUrl: result.photoUrl });
    await photo.linkStudentPhoto({ schoolId: SCHOOL_A, studentId, assetId: result.pendingLinkAssetId! });
    assert.equal(String((await assetDoc(assetId))?.association?.id), String(studentId));
  });
});

describe("releasing the previous photo", () => {
  test("soft-deletes this student's own photo", async () => {
    const studentId = await seedStudent();
    const assetId = await seedAsset({ association: { type: "student", id: studentId } });
    assert.equal(
      await photo.releasePreviousStudentPhoto({ schoolId: SCHOOL_A, studentId, url: assetPath(assetId) }),
      true
    );
    assert.equal((await assetDoc(assetId))?.status, "deleted");
  });

  test("leaves other students' photos, other schools and other kinds alone", async () => {
    const studentId = await seedStudent();
    const otherStudent = await seedStudent();
    const linkedElsewhere = await seedAsset({ association: { type: "student", id: otherStudent } });
    const referencedElsewhere = await seedAsset();
    await setStudentPhoto(otherStudent, assetPath(referencedElsewhere));
    const foreign = await seedAsset({ schoolId: SCHOOL_B });
    const teacherAvatar = await seedAsset({ kind: "teacher_avatar", visibility: "public" });

    for (const assetId of [linkedElsewhere, referencedElsewhere, foreign, teacherAvatar]) {
      assert.equal(
        await photo.releasePreviousStudentPhoto({ schoolId: SCHOOL_A, studentId, url: assetPath(assetId) }),
        false
      );
      assert.equal((await assetDoc(assetId))?.status, "ready");
    }
  });

  test("ignores legacy external URLs", async () => {
    const studentId = await seedStudent();
    assert.equal(
      await photo.releasePreviousStudentPhoto({
        schoolId: SCHOOL_A,
        studentId,
        url: "https://legacy.example.test/photo.jpg",
      }),
      false
    );
  });
});
