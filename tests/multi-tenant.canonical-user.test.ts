import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { User } from "../src/models/User";
import { UserMembership } from "../src/models/UserMembership";
import {
  ensureCanonicalUserForEmail,
  ensureMembershipForUser,
} from "../src/lib/auth/canonical-user";

let replSet: MongoMemoryReplSet | undefined;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replSet.getUri(), { dbName: "multi_tenant_identity_test" });
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

test("ensureCanonicalUserForEmail reuses one user across school memberships", async () => {
  const schoolA = new mongoose.Types.ObjectId();
  const schoolB = new mongoose.Types.ObjectId();

  const first = await ensureCanonicalUserForEmail({
    email: "parent@example.com",
    firstName: "Ama",
    lastName: "Mensah",
    schoolId: schoolA,
    role: "parent",
  });

  await ensureMembershipForUser({
    userId: first._id,
    schoolId: schoolA,
    role: "parent",
    status: "active",
  });

  const second = await ensureCanonicalUserForEmail({
    email: "parent@example.com",
    schoolId: schoolB,
    role: "parent",
  });

  await ensureMembershipForUser({
    userId: second._id,
    schoolId: schoolB,
    role: "parent",
    status: "active",
  });

  assert.equal(String(first._id), String(second._id));

  const users = await User.find({ email: "parent@example.com" }).lean();
  assert.equal(users.length, 1);

  const memberships = await UserMembership.find({ userId: first._id }).lean();
  assert.equal(memberships.length, 2);
  assert.deepEqual(
    memberships.map((membership) => String(membership.schoolId)).sort(),
    [String(schoolA), String(schoolB)].sort()
  );
});

test("ensureMembershipForUser upserts without duplicate rows", async () => {
  const schoolId = new mongoose.Types.ObjectId();
  const user = await ensureCanonicalUserForEmail({
    email: "teacher@example.com",
    role: "teacher",
    schoolId,
  });

  await ensureMembershipForUser({
    userId: user._id,
    schoolId,
    role: "teacher",
    status: "invited",
  });
  await ensureMembershipForUser({
    userId: user._id,
    schoolId,
    role: "teacher",
    status: "active",
  });

  const memberships = await UserMembership.find({ userId: user._id, schoolId }).lean();
  assert.equal(memberships.length, 1);
  assert.equal(memberships[0]?.status, "active");
  assert.deepEqual(memberships[0]?.roles, ["teacher"]);
});
