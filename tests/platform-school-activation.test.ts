import assert from "node:assert/strict";
import nodeModule from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, beforeEach, describe, test } from "node:test";
import mongoose, { Types } from "mongoose";
import { NextRequest } from "next/server";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { stubServerOnly } from "./regression/helpers/stub-server-only";
import { evaluateAssessPremiumPublicationEntitlement } from "../src/lib/subscriptions/assess-premium-policy";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { AuditEvent } from "../src/models/AuditEvent";
import { AuditStreamHead } from "../src/models/AuditStreamHead";
import { ClassGroup } from "../src/models/ClassGroup";
import { FeeStructure } from "../src/models/FeeStructure";
import { Grade } from "../src/models/Grade";
import { Guardian } from "../src/models/Guardian";
import { School } from "../src/models/School";
import { SchoolSubscription } from "../src/models/SchoolSubscription";
import { Student } from "../src/models/Student";
import { SubjectOffering } from "../src/models/SubjectOffering";
import { Teacher } from "../src/models/Teacher";
import { User } from "../src/models/User";
import { UserMembership } from "../src/models/UserMembership";

stubServerOnly();

type ResolveResult = { url: string; format?: string | null; shortCircuit?: boolean };
type RegisterHooks = (hooks: {
  resolve: (
    specifier: string,
    context: unknown,
    nextResolve: (specifier: string, context?: unknown) => ResolveResult,
  ) => ResolveResult;
}) => unknown;

const registerHooks = (nodeModule as unknown as { registerHooks?: RegisterHooks }).registerHooks;
if (typeof registerHooks !== "function") {
  throw new Error("module.registerHooks is unavailable; use Node >= 22.15");
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/platform/auth/require-platform-permission") {
      return {
        url: pathToFileURL(path.resolve(process.cwd(), "tests/platform-school-activation-permission.cjs")).href,
        format: "commonjs",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const PLATFORM_ADMIN = new Types.ObjectId();
const PLATFORM_ACTOR = {
  _id: PLATFORM_ADMIN,
  userId: PLATFORM_ADMIN,
  email: "platform@example.test",
  isLegacyPlatformAdmin: true,
  permissions: ["platform.schools.activate"],
  role: "platform_admin",
  source: "legacy_platform_admin" as const,
  rolePreset: "platform_owner",
  status: "active" as const,
  accessMode: "all_schools" as const,
};

let replSet: MongoMemoryReplSet;
let activateRoute: typeof import("../src/app/api/platform/schools/[id]/activate/route").POST;
let reactivateRoute: typeof import("../src/app/api/platform/schools/[id]/reactivate/route").POST;
let transitionSchoolToActive: typeof import("../src/lib/platform/schools/transition-to-active").transitionSchoolToActive;
let getPlatformSchoolDetail: typeof import("../src/lib/platform-billing/platform-schools").getPlatformSchoolDetail;
let getSchoolSetupProgress: typeof import("../src/lib/platform/schools/setup-progress").getSchoolSetupProgress;

function setPermissionGate(ok: boolean) {
  (globalThis as { __platformSchoolActivationPermission?: unknown }).__platformSchoolActivationPermission = ok
    ? { ok: true, permission: "platform.schools.activate", actor: PLATFORM_ACTOR }
    : { ok: false };
}

function request(body: Record<string, unknown>, key = `activation:${new Types.ObjectId()}`) {
  return new NextRequest("http://localhost/api/platform/schools/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": key,
    },
    body: JSON.stringify(body),
  });
}

async function createSchool(status: "pending" | "active" | "deactivated" = "pending", name = `Activation School ${new Types.ObjectId()}`) {
  return School.create({
    name,
    type: "Basic",
    curriculumCode: "ghana_nacca",
    status,
  });
}

async function seedSetup(schoolId: Types.ObjectId, completePayment = false) {
  const gradeId = new Types.ObjectId();
  const classGroupId = new Types.ObjectId();
  const subjectId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  await School.updateOne(
    { _id: schoolId },
    {
      $set: {
        email: "school@example.test",
        city: "Accra",
        region: "Greater Accra",
        ...(completePayment
          ? { "billing.status": "provisioned", "billing.paystack.subaccountCode": "ACCT_123456" }
          : {}),
      },
    },
  );
  await AcademicPeriod.create({
    schoolId,
    yearLabel: "2026/2027",
    term: "First Term",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-12-20"),
    isCurrent: true,
  });
  await Grade.create({ _id: gradeId, schoolId, name: "Basic 1" });
  await ClassGroup.create({ _id: classGroupId, schoolId, gradeId, name: "A" });
  await SubjectOffering.create({
    schoolId,
    subjectId,
    curriculumCode: "ghana_nacca",
    subjectFamily: "Mathematics",
    displayName: "Mathematics",
    shortName: "Maths",
    code: "MATHS",
    stage: "lower_primary",
    gradeBand: "lower_primary",
    gradeIds: [gradeId],
  });
  await User.create({
    _id: userId,
    email: "pending-admin@example.test",
    schoolId,
    role: "school_admin",
    pendingOnboarding: true,
  });
  await UserMembership.create({ userId, schoolId, roles: ["school_admin"], status: "active" });

  if (!completePayment) return { gradeId, classGroupId, userId };

  const teacherUserId = new Types.ObjectId();
  const studentUserId = new Types.ObjectId();
  await Teacher.create({ schoolId, userId: teacherUserId, status: "active" });
  const student = await Student.create({
    schoolId,
    userId: studentUserId,
    firstName: "Ama",
    lastName: "Student",
    gradeId,
    classGroupId,
    status: "active",
    enrolledAt: new Date("2026-09-01"),
  });
  await Guardian.create({
    studentId: student._id,
    userId: new Types.ObjectId(),
    relationship: "mother",
    isPrimary: true,
    email: "parent@example.test",
  });
  await FeeStructure.create({
    schoolId,
    name: "Tuition",
    code: "TUITION",
    category: "tuition",
    allowsInstallments: false,
  });
  return { gradeId, classGroupId, userId };
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, name: "rs0" } });
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGO_DB_NAME = "platform_school_activation";
  await mongoose.connect(replSet.getUri(), { dbName: "platform_school_activation" });
  ({ POST: activateRoute } = await import("../src/app/api/platform/schools/[id]/activate/route"));
  ({ POST: reactivateRoute } = await import("../src/app/api/platform/schools/[id]/reactivate/route"));
  ({ transitionSchoolToActive } = await import("../src/lib/platform/schools/transition-to-active"));
  ({ getPlatformSchoolDetail } = await import("../src/lib/platform-billing/platform-schools"));
  ({ getSchoolSetupProgress } = await import("../src/lib/platform/schools/setup-progress"));
});

beforeEach(async () => {
  setPermissionGate(true);
  await Promise.all([
    AuditEvent.deleteMany({}),
    AuditStreamHead.deleteMany({}),
    School.deleteMany({}),
    SchoolSubscription.deleteMany({}),
    AcademicPeriod.deleteMany({}),
    ClassGroup.deleteMany({}),
    FeeStructure.deleteMany({}),
    Grade.deleteMany({}),
    Guardian.deleteMany({}),
    Student.deleteMany({}),
    SubjectOffering.deleteMany({}),
    Teacher.deleteMany({}),
    User.deleteMany({}),
    UserMembership.deleteMany({}),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe("school activation and onboarding separation", () => {
  test("activates a pending school at 0% setup and records the exact state", async () => {
    const school = await createSchool();
    const response = await activateRoute(request({ reason: "Approved launch before setup completion." }), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { transitioned: boolean; setupProgress: { percent: number } } };
    assert.equal(body.data.transitioned, true);
    assert.equal(body.data.setupProgress.percent, 0);
    assert.equal((await School.findById(school._id).lean())?.status, "active");
    const audit = await AuditEvent.findOne({ actionCode: "school.lifecycle.activated", targetEntityId: school._id }).lean();
    assert.equal(audit?.reason, "Approved launch before setup completion.");
    assert.deepEqual(audit?.before, { status: "pending" });
    assert.deepEqual(audit?.after, { status: "active" });
    assert.equal((audit?.metadata as { setupProgress?: { percent?: number } })?.setupProgress?.percent, 0);
  });

  test("activates a pending school at 55% without changing setup records", async () => {
    const school = await createSchool();
    await seedSetup(school._id);
    const beforeProgress = await getSchoolSetupProgress(school._id);
    const beforeMembership = await UserMembership.findOne({ schoolId: school._id })
      .select("userId schoolId roles status")
      .lean();
    assert.ok(beforeMembership);
    const response = await activateRoute(request({ reason: "Launch approved while remaining setup is tracked." }), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { setupProgress: { percent: number; completed: number } } };
    assert.equal(body.data.setupProgress.percent, 55);
    assert.equal(body.data.setupProgress.completed, 6);
    assert.deepEqual(
      await UserMembership.findOne({ schoolId: school._id }).select("userId schoolId roles status").lean(),
      beforeMembership,
    );
    assert.deepEqual(await getSchoolSetupProgress(school._id), beforeProgress);
    assert.equal((await User.findOne({ schoolId: school._id }).lean())?.pendingOnboarding, true);
    assert.equal((await School.findById(school._id).lean())?.status, "active");
  });

  test("active status remains active while later setup updates remain independent", async () => {
    const school = await createSchool("active");
    await seedSetup(school._id);
    const current = await School.findById(school._id).lean();
    const progress = await getSchoolSetupProgress(school._id);
    assert.equal(current?.status, "active");
    assert.equal(progress.percent, 55);
    assert.equal(current?.billing?.paymentSetup?.status ?? "not_started", "not_started");
  });

  test("activates a fully configured school without payment or subscription mutation", async () => {
    const school = await createSchool();
    await seedSetup(school._id, true);
    const response = await activateRoute(request({ reason: "All launch checks are complete." }), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(response.status, 200);
    const body = await response.json() as { data: { setupProgress: { percent: number } } };
    assert.equal(body.data.setupProgress.percent, 100);
    const current = await School.findById(school._id).lean();
    assert.equal(current?.status, "active");
    assert.equal(current?.billing?.paymentSetup?.status ?? "not_started", "not_started");
    assert.equal(await SchoolSubscription.countDocuments({ schoolId: school._id }), 0);
  });

  test("repeated activation is idempotent and does not duplicate audit events", async () => {
    const school = await createSchool();
    const first = await activateRoute(request({ reason: "First approved activation." }, "same-request"), { params: Promise.resolve({ id: String(school._id) }) });
    const second = await activateRoute(request({ reason: "Retry after response timeout." }, "same-request"), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).data.transitioned, false);
    assert.equal(await AuditEvent.countDocuments({ actionCode: "school.lifecycle.activated", targetEntityId: school._id }), 1);
  });

  test("concurrent activation creates one transition and one audit event", async () => {
    const school = await createSchool();
    const results = await Promise.all([
      transitionSchoolToActive({ req: request({ reason: "Concurrent activation A." }, "concurrent-a"), schoolId: school._id, actor: PLATFORM_ACTOR, reason: "Concurrent activation A.", kind: "activation" }),
      transitionSchoolToActive({ req: request({ reason: "Concurrent activation B." }, "concurrent-b"), schoolId: school._id, actor: PLATFORM_ACTOR, reason: "Concurrent activation B.", kind: "activation" }),
    ]);
    assert.equal(results.filter((result) => result.transitioned).length, 1);
    assert.equal(results.filter((result) => !result.transitioned).length, 1);
    assert.equal(await AuditEvent.countDocuments({ actionCode: "school.lifecycle.activated", targetEntityId: school._id }), 1);
  });

  test("audit failure rolls back the lifecycle change", async () => {
    const school = await createSchool();
    const originalCreate = AuditEvent.create;
    (AuditEvent as unknown as { create: typeof AuditEvent.create }).create = (async () => {
      throw new Error("forced audit failure");
    }) as typeof AuditEvent.create;
    try {
      await assert.rejects(
        transitionSchoolToActive({
          req: request({ reason: "Audit rollback verification." }),
          schoolId: school._id,
          actor: PLATFORM_ACTOR,
          reason: "Audit rollback verification.",
          kind: "activation",
        }),
      );
    } finally {
      (AuditEvent as unknown as { create: typeof AuditEvent.create }).create = originalCreate;
    }
    assert.equal((await School.findById(school._id).lean())?.status, "pending");
    assert.equal(await AuditEvent.countDocuments({ targetEntityId: school._id }), 0);
  });

  test("pending activation does not reactivate a deactivated school", async () => {
    const school = await createSchool("deactivated");
    const response = await activateRoute(request({ reason: "Attempted pending activation." }), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(response.status, 409);
    assert.equal((await School.findById(school._id).lean())?.status, "deactivated");
    assert.equal(await AuditEvent.countDocuments({ targetEntityId: school._id }), 0);
  });

  test("reactivation remains a separate reasoned platform-admin action", async () => {
    const school = await createSchool("deactivated");
    const response = await reactivateRoute(request({ reason: "Restriction reviewed and cleared." }), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(response.status, 200);
    assert.equal((await School.findById(school._id).lean())?.status, "active");
    assert.equal(await AuditEvent.countDocuments({ actionCode: "school.lifecycle.reactivated", targetEntityId: school._id }), 1);
  });

  test("school administrators cannot invoke the platform activation route", async () => {
    const school = await createSchool();
    setPermissionGate(false);
    const response = await activateRoute(request({ reason: "School-admin attempt." }), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(response.status, 403);
    assert.equal((await School.findById(school._id).lean())?.status, "pending");
  });

  test("the route requires the dedicated activation permission and a reason", async () => {
    const school = await createSchool();
    (globalThis as { __platformSchoolActivationPermission?: unknown }).__platformSchoolActivationPermission = {
      ok: true,
      permission: "platform.schools.read",
      actor: PLATFORM_ACTOR,
    };
    const wrongPermission = await activateRoute(request({ reason: "Should not pass." }), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(wrongPermission.status, 403);

    setPermissionGate(true);
    const missingReason = await activateRoute(request({}), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(missingReason.status, 400);
    assert.equal((await School.findById(school._id).lean())?.status, "pending");
    assert.equal(await AuditEvent.countDocuments({ targetEntityId: school._id }), 0);
  });

  test("pending and non-Enterprise schools remain blocked by the existing Assess policy", async () => {
    const base = {
      enforcementEnabled: true,
      apiGatesEnabled: true,
      planCode: "enterprise",
      accessMode: "full" as const,
      featureEnabled: true,
    };
    assert.equal(
      evaluateAssessPremiumPublicationEntitlement({ ...base, schoolStatus: "pending" }).allowed,
      false,
    );
    const school = await createSchool();
    await activateRoute(request({ reason: "Explicit activation before Assess review." }), { params: Promise.resolve({ id: String(school._id) }) });
    assert.equal(
      evaluateAssessPremiumPublicationEntitlement({ ...base, schoolStatus: "active" }).allowed,
      true,
    );
    assert.equal(
      evaluateAssessPremiumPublicationEntitlement({ ...base, schoolStatus: "active", planCode: "growth" }).allowed,
      false,
    );
    assert.equal(
      evaluateAssessPremiumPublicationEntitlement({ ...base, schoolStatus: "active", planCode: null }).allowed,
      false,
    );
  });

  test("platform school detail reads subscription state from the authoritative record", async () => {
    const school = await createSchool();
    await SchoolSubscription.create({
      schoolId: school._id,
      tierCode: "enterprise",
      tierName: "Enterprise",
      status: "active",
      studentCountSnapshot: 0,
      basePriceMinor: 10000,
      discountMode: "none",
      effectivePriceMinor: 10000,
    });

    const detail = await getPlatformSchoolDetail(String(school._id));
    assert.deepEqual(detail?.subscription, {
      tierName: "Enterprise",
      status: "active",
      effectivePriceMinor: 10000,
      discountExposureMinor: 0,
    });
  });
});
