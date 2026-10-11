import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { stubServerOnly } from "../regression/helpers/stub-server-only";
import {
  SCHOOL_B,
  assetPath,
  resetStorageDb,
  seedAsset,
  seedStudent,
  setStudentPhoto,
  startStorageDb,
  stopStorageDb,
} from "./helpers/school-fixtures";

stubServerOnly();

let migration: typeof import("@/lib/storage/student-avatar-migration");

before(
  async () => {
    await startStorageDb("student_avatar_migration");
    migration = await import("@/lib/storage/student-avatar-migration");
  },
  { timeout: 180_000 }
);

after(stopStorageDb);
beforeEach(resetStorageDb);

async function doc(id: Types.ObjectId) {
  return mongoose.model("StoredAsset").collection.findOne({ _id: id });
}

async function seedScenario() {
  const linkedStudent = await seedStudent();
  const linked = await seedAsset({ visibility: "public", association: { type: "student", id: linkedStudent } });
  await setStudentPhoto(linkedStudent, assetPath(linked));

  const legacyStudent = await seedStudent();
  const linkable = await seedAsset({ visibility: "public" });
  await setStudentPhoto(legacyStudent, assetPath(linkable));

  const ambiguous = await seedAsset({ visibility: "public" });
  await setStudentPhoto(await seedStudent(), assetPath(ambiguous));
  await setStudentPhoto(await seedStudent(), assetPath(ambiguous));

  const unreferenced = await seedAsset({ visibility: "public" });
  const alreadyPrivate = await seedAsset({ visibility: "private" });

  const crossSchool = await seedAsset({ visibility: "public" });
  await setStudentPhoto(await seedStudent({ schoolId: SCHOOL_B }), assetPath(crossSchool));

  await seedStudent({ photoUrl: "https://legacy.example.test/photo.jpg" });
  await seedStudent({ photoUrl: null });

  const teacherAvatar = await seedAsset({ kind: "teacher_avatar", visibility: "public" });
  const brand = await seedAsset({ kind: "school_brand_image", visibility: "public" });

  return {
    linkedStudent,
    linked,
    linkable,
    legacyStudent,
    ambiguous,
    unreferenced,
    alreadyPrivate,
    crossSchool,
    teacherAvatar,
    brand,
  };
}

describe("student avatar metadata migration", () => {
  test("dry run counts every category and writes nothing", async () => {
    const s = await seedScenario();
    const plan = await migration.planStudentAvatarMigration();
    assert.equal(plan.counts.assets, 6);
    assert.deepEqual(plan.counts.byVisibility, { public: 5, private: 1 });
    assert.equal(plan.counts.linkedToStudent, 1);
    assert.equal(plan.counts.linkable, 1);
    assert.equal(plan.counts.ambiguous, 1);
    assert.equal(plan.counts.unreferenced, 3);
    assert.equal(plan.counts.crossSchoolReferences, 1);
    assert.deepEqual(plan.ambiguousAssetIds, [String(s.ambiguous)]);
    assert.equal(plan.counts.studentPhotoUrl.internalAsset, 5);
    assert.equal(plan.counts.studentPhotoUrl.external, 1);
    assert.ok(plan.counts.studentPhotoUrl.none >= 1);
    assert.equal(plan.changes.length, 5);
    assert.equal((await doc(s.linkable))?.visibility, "public");
    assert.equal((await doc(s.linkable))?.association, null);
  });

  test("apply makes photos private, links only the unambiguous one, and is idempotent", async () => {
    const s = await seedScenario();
    const plan = await migration.planStudentAvatarMigration();
    const result = await migration.applyStudentAvatarMigration(plan.changes);
    assert.deepEqual(result, { updated: 5, skipped: 0 });

    for (const id of [s.linked, s.linkable, s.ambiguous, s.unreferenced, s.alreadyPrivate, s.crossSchool]) {
      assert.equal((await doc(id))?.visibility, "private");
    }
    assert.equal(String((await doc(s.linkable))?.association?.id), String(s.legacyStudent));
    assert.equal((await doc(s.ambiguous))?.association, null);
    assert.equal((await doc(s.unreferenced))?.association, null);
    assert.equal((await doc(s.crossSchool))?.association, null);

    assert.equal((await doc(s.teacherAvatar))?.visibility, "public");
    assert.equal((await doc(s.brand))?.visibility, "public");

    const rerun = await migration.planStudentAvatarMigration();
    assert.equal(rerun.changes.length, 0);
  });

  test("a concurrent link is skipped rather than overwritten", async () => {
    const s = await seedScenario();
    const plan = await migration.planStudentAvatarMigration();
    const someoneElse = new Types.ObjectId();
    await mongoose
      .model("StoredAsset")
      .collection.updateOne({ _id: s.linkable }, { $set: { association: { type: "student", id: someoneElse } } });
    await migration.applyStudentAvatarMigration(plan.changes);
    assert.equal(String((await doc(s.linkable))?.association?.id), String(someoneElse));
  });

  test("rollback from the manifest restores visibility and removes added links", async () => {
    const s = await seedScenario();
    const plan = await migration.planStudentAvatarMigration();
    const manifest = JSON.parse(JSON.stringify(migration.buildManifest(plan)));
    await migration.applyStudentAvatarMigration(plan.changes);

    const result = await migration.rollbackStudentAvatarMigration(manifest);
    assert.equal(result.restored, 5);
    assert.equal((await doc(s.linkable))?.visibility, "public");
    assert.equal((await doc(s.linkable))?.association, null);
    assert.equal((await doc(s.linked))?.visibility, "public");
    assert.equal(String((await doc(s.linked))?.association?.id), String(s.linkedStudent));
    assert.equal((await doc(s.alreadyPrivate))?.visibility, "private");
  });

  test("rollback refuses an unrecognised manifest", async () => {
    await assert.rejects(
      migration.rollbackStudentAvatarMigration({ version: 2, entries: [] } as never),
      /Unrecognised manifest/
    );
  });
});
