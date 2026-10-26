import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { stubServerOnly } from "./regression/helpers/stub-server-only";

stubServerOnly();

let gatePersonalTeacherAccess: typeof import("../src/lib/auth/role-gates")["gatePersonalTeacherAccess"];
let hasPlatformPermission: typeof import("../src/lib/platform/auth/has-platform-permission")["hasPlatformPermission"];
let listSchoolAdministrators: typeof import("../src/lib/platform/schools/admin-teaching-access")["listSchoolAdministrators"];
let setAdministratorTeachingAccess: typeof import("../src/lib/platform/schools/admin-teaching-access")["setAdministratorTeachingAccess"];
let PlatformAuditLog: typeof import("../src/models/PlatformAuditLog")["PlatformAuditLog"];
let School: typeof import("../src/models/School")["School"];
let Teacher: typeof import("../src/models/Teacher")["Teacher"];
let TeacherAssignment: typeof import("../src/models/TeacherAssignment")["TeacherAssignment"];
let User: typeof import("../src/models/User")["User"];
let UserMembership: typeof import("../src/models/UserMembership")["UserMembership"];

let replSet: MongoMemoryReplSet;
const actorUserId = new mongoose.Types.ObjectId();

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGO_DB_NAME = "platform_admin_teaching_access";
  ({ gatePersonalTeacherAccess } = await import("../src/lib/auth/role-gates"));
  ({ hasPlatformPermission } = await import("../src/lib/platform/auth/has-platform-permission"));
  ({ listSchoolAdministrators, setAdministratorTeachingAccess } = await import(
    "../src/lib/platform/schools/admin-teaching-access"
  ));
  ({ PlatformAuditLog } = await import("../src/models/PlatformAuditLog"));
  ({ School } = await import("../src/models/School"));
  ({ Teacher } = await import("../src/models/Teacher"));
  ({ TeacherAssignment } = await import("../src/models/TeacherAssignment"));
  ({ User } = await import("../src/models/User"));
  ({ UserMembership } = await import("../src/models/UserMembership"));
  const { connectToDatabase } = await import("../src/db/connectToDatabase");
  await connectToDatabase();
  for (const name of ["School", "User", "UserMembership", "Teacher", "TeacherAssignment", "PlatformAuditLog"]) {
    await mongoose.model(name).createCollection().catch(() => undefined);
  }
}, { timeout: 180_000 });

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    School.deleteMany({}),
    User.deleteMany({}),
    UserMembership.deleteMany({}),
    Teacher.deleteMany({}),
    TeacherAssignment.deleteMany({}),
    PlatformAuditLog.deleteMany({}),
  ]);
});

async function seedSchool() {
  return School.create({
    name: "Access Test School",
    type: "Basic",
    curriculumCode: "ghana_nacca",
    status: "active",
  });
}

async function seedAdministrator(
  schoolId: mongoose.Types.ObjectId,
  input: {
    status?: "active" | "invited" | "suspended";
    userId?: mongoose.Types.ObjectId;
    withTeacher?: boolean;
    teacherStatus?: "active" | "inactive" | "on_leave" | "terminated";
  } = {}
) {
  const userId = input.userId || new mongoose.Types.ObjectId();
  await User.create({
    _id: userId,
    email: `${userId}@example.test`,
    firstName: "Ama",
    lastName: "Mensah",
    role: "school_admin",
    pendingOnboarding: true,
  });
  await UserMembership.create({
    userId,
    schoolId,
    roles: ["school_admin"],
    status: input.status || "active",
  });
  if (input.withTeacher) {
    await Teacher.create({
      schoolId,
      userId,
      status: input.teacherStatus || "active",
      subjectIds: [],
      subjectOfferingIds: [],
    });
  }
  return userId;
}

test("enabling is idempotent, preserves the canonical admin, and creates one teacher profile", async () => {
  const school = await seedSchool();
  const userId = await seedAdministrator(school._id);

  const first = await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(userId),
    actorUserId,
    enabled: true,
  });
  assert.equal(first.ok, true);

  const second = await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(userId),
    actorUserId,
    enabled: true,
  });
  assert.equal(second.ok, true);

  const membership = await UserMembership.findOne({ userId, schoolId: school._id }).lean();
  const user = await User.findById(userId).lean();
  assert.deepEqual([...((membership?.roles || []) as string[])].sort(), ["school_admin", "teacher"]);
  assert.equal(user?.role, "school_admin");
  assert.equal(user?.pendingOnboarding, true);
  assert.equal(await Teacher.countDocuments({ userId, schoolId: school._id }), 1);
  assert.equal(await PlatformAuditLog.countDocuments({ schoolId: school._id }), 2);
});

test("enabling reuses an active teacher profile and rejects non-active profiles", async () => {
  const school = await seedSchool();
  const existing = await seedAdministrator(school._id, { withTeacher: true });
  const reused = await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(existing),
    actorUserId,
    enabled: true,
  });
  assert.equal(reused.ok, true);
  assert.equal(await Teacher.countDocuments({ userId: existing, schoolId: school._id }), 1);

  const inactive = await seedAdministrator(school._id, {
    withTeacher: true,
    teacherStatus: "terminated",
  });
  const rejected = await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(inactive),
    actorUserId,
    enabled: true,
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.code, "TEACHER_PROFILE_NOT_ACTIVE");
});

test("invalid, suspended, and cross-school administrators cannot be enabled", async () => {
  const school = await seedSchool();
  const otherSchool = await School.create({
    name: "Other School",
    type: "Basic",
    curriculumCode: "ghana_nacca",
    status: "active",
  });
  const suspended = await seedAdministrator(school._id, { status: "suspended" });
  const otherAdmin = await seedAdministrator(otherSchool._id);

  const suspendedResult = await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(suspended),
    actorUserId,
    enabled: true,
  });
  assert.equal(suspendedResult.ok, false);
  if (!suspendedResult.ok) assert.equal(suspendedResult.code, "ADMIN_MEMBERSHIP_INACTIVE");

  const crossSchoolResult = await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(otherAdmin),
    actorUserId,
    enabled: true,
  });
  assert.equal(crossSchoolResult.ok, false);
  if (!crossSchoolResult.ok) assert.equal(crossSchoolResult.code, "ADMIN_MEMBERSHIP_NOT_FOUND");
});

test("listing returns every administrator and disable preserves admin access and teaching history", async () => {
  const school = await seedSchool();
  const first = await seedAdministrator(school._id, { withTeacher: true });
  const second = await seedAdministrator(school._id);
  await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(first),
    actorUserId,
    enabled: true,
  });

  const listed = await listSchoolAdministrators(String(school._id));
  assert.equal(listed.ok, true);
  if (listed.ok) assert.equal(listed.data.administrators.length, 2);

  const teacher = await Teacher.findOne({ schoolId: school._id, userId: first });
  assert.ok(teacher);
  await TeacherAssignment.create({
    schoolId: school._id,
    teacherId: teacher!._id,
    academicPeriodId: new mongoose.Types.ObjectId(),
    subjectId: new mongoose.Types.ObjectId(),
    classGroupId: new mongoose.Types.ObjectId(),
    status: "active",
    assignedAt: new Date(),
  });

  const blocked = await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(first),
    actorUserId,
    enabled: false,
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.code, "ACTIVE_ASSIGNMENTS");

  await TeacherAssignment.deleteMany({ teacherId: teacher!._id });
  const disabled = await setAdministratorTeachingAccess({
    schoolId: String(school._id),
    userId: String(first),
    actorUserId,
    enabled: false,
  });
  assert.equal(disabled.ok, true);
  const membership = await UserMembership.findOne({ userId: first, schoolId: school._id }).lean();
  assert.deepEqual(membership?.roles, ["school_admin"]);
  assert.equal(await Teacher.countDocuments({ _id: teacher!._id }), 1);
  assert.ok(await UserMembership.exists({ userId: second, schoolId: school._id, roles: "school_admin" }));
});

test("personal Teacher access requires the explicit teacher role and platform permission is fail-closed", () => {
  assert.equal(gatePersonalTeacherAccess(["school_admin"]).ok, false);
  assert.equal(gatePersonalTeacherAccess(["school_admin", "teacher"]).ok, true);
  assert.equal(
    hasPlatformPermission(
      { permissions: [], isLegacyPlatformAdmin: false },
      "platform.schools.manageAdminRoles"
    ),
    false
  );
});
