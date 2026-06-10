/**
 * Merge duplicate User documents that share the same normalized email.
 *
 * Usage:
 *   npx tsx scripts/migrations/merge-duplicate-users-by-email.ts --dry-run
 *   npx tsx scripts/migrations/merge-duplicate-users-by-email.ts --apply
 *
 * This migration is intentionally narrow: it consolidates person identity
 * while preserving school access in UserMembership rows.
 */
import mongoose, { type Types } from "mongoose";
import { config as loadEnv } from "dotenv";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { Teacher } from "@/models/Teacher";
import { Guardian } from "@/models/Guardian";
import { isMembershipRole, type MembershipRole } from "@/lib/roles";

loadEnv({ path: ".env.local", quiet: true });

type UserDoc = IUser & {
  _id: Types.ObjectId;
  phone?: string | null;
  address?: string | null;
};

type RefTarget = {
  collection: string;
  fields: string[];
};

type MigrationMembership = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles?: string[];
  subroles?: string[];
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const REF_TARGETS: RefTarget[] = [
  { collection: "students", fields: ["userId"] },
  { collection: "notifications", fields: ["userId"] },
  { collection: "parentdevicetokens", fields: ["userId"] },
  { collection: "communicationpreferences", fields: ["userId"] },
  { collection: "emailpreferences", fields: ["userId"] },
  { collection: "teachersettings", fields: ["userId"] },
  { collection: "meetingparticipants", fields: ["userId", "invitedByUserId"] },
  { collection: "meetings", fields: ["hostUserId", "createdBy"] },
  { collection: "invitations", fields: ["invitedBy"] },
  { collection: "delegations", fields: ["staffUserId", "createdBy", "revokedBy"] },
  { collection: "platformdelegations", fields: ["staffUserId", "createdBy", "revokedBy"] },
  { collection: "schools", fields: ["createdBy", "billing.paymentSetup.ownerUserId", "billing.paymentSetup.delegateUserId", "billing.paymentSetup.updatedBy"] },
  { collection: "admissionapplications", fields: ["processedBy"] },
  { collection: "admissionevents", fields: ["actor.userId"] },
  { collection: "classgroups", fields: ["createdBy", "updatedBy"] },
  { collection: "teacheractivities", fields: ["createdBy"] },
  { collection: "financialtransactions", fields: ["createdBy", "uploadedBy", "matchedBy", "requestedBy", "decidedBy", "voidedBy"] },
  { collection: "expenses", fields: ["requestedBy", "approvedBy", "rejectedBy", "paidBy", "createdBy"] },
  { collection: "expensecategories", fields: ["createdBy"] },
  { collection: "vendors", fields: ["createdBy"] },
  { collection: "paymentintents", fields: ["initiatedBy"] },
  { collection: "fundraisingdonations", fields: ["donorUserId"] },
  { collection: "usagemetrics", fields: ["updatedBy"] },
  { collection: "timetableversions", fields: ["createdBy", "publishedBy"] },
  { collection: "promotionpolicies", fields: ["createdBy", "updatedBy"] },
  { collection: "curricula", fields: ["createdByUserId", "updatedByUserId"] },
  { collection: "platformfeatureflags", fields: ["updatedBy"] },
  { collection: "platformassistedaccesssessions", fields: ["actorUserId", "endedByUserId"] },
];

function normalizeEmail(email: unknown) {
  return String(email || "").trim().toLowerCase();
}

function roleToMembership(role: unknown): MembershipRole | null {
  const value = typeof role === "string" ? role : "";
  return isMembershipRole(value) ? value : null;
}

function objectId(value: unknown) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function scoreUser(user: UserDoc) {
  let score = 0;
  if (user.clerkUserId) score += 100;
  if (user.schoolId) score += 50;
  if (user.pendingOnboarding === false) score += 20;
  if (user.name) score += 10;
  if (user.firstName) score += 8;
  if (user.lastName) score += 8;
  if (user.phone) score += 6;
  if (user.avatarUrl) score += 6;
  if (user.role === "platform_admin") score += 4;
  return score;
}

function pickCanonical(users: UserDoc[]) {
  return [...users].sort((a, b) => {
    const scoreDiff = scoreUser(b) - scoreUser(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  })[0];
}

function mergeUserSet(canonical: UserDoc, duplicates: UserDoc[]) {
  const set: Record<string, unknown> = {};

  for (const key of ["name", "firstName", "lastName", "phone", "avatarUrl", "avatarPublicId", "address", "dateOfBirth"] as const) {
    if (!canonical[key]) {
      const donor = duplicates.find((user) => user[key]);
      if (donor?.[key]) set[key] = donor[key];
    }
  }

  if (!canonical.role) {
    const donor = duplicates.find((user) => user.role);
    if (donor?.role) set.role = donor.role;
  }

  if (!canonical.schoolId) {
    const donor = duplicates.find((user) => user.schoolId);
    if (donor?.schoolId) set.schoolId = donor.schoolId;
  }

  if (!canonical.clerkUserId) {
    const donor = duplicates.find((user) => user.clerkUserId);
    if (donor?.clerkUserId) set.clerkUserId = donor.clerkUserId;
  }

  return { set };
}

async function countRefs(oldId: Types.ObjectId) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo connection is not ready.");
  const counts: Record<string, number> = {};
  for (const target of REF_TARGETS) {
    const collection = db.collection(target.collection);
    for (const field of target.fields) {
      const count = await collection.countDocuments({ [field]: oldId });
      if (count > 0) counts[`${target.collection}.${field}`] = count;
    }
  }
  return counts;
}

async function updateRefTargets(oldId: Types.ObjectId, canonicalId: Types.ObjectId) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo connection is not ready.");
  const counts: Record<string, number> = {};
  for (const target of REF_TARGETS) {
    const collection = db.collection(target.collection);
    for (const field of target.fields) {
      const result = await collection.updateMany(
        { [field]: oldId },
        { $set: { [field]: canonicalId } }
      );
      if (result.modifiedCount > 0) {
        counts[`${target.collection}.${field}`] = result.modifiedCount;
      }
    }
  }
  return counts;
}

async function mergeMemberships(canonicalId: Types.ObjectId, duplicate: UserDoc, apply: boolean) {
  const operations: string[] = [];
  const duplicateMemberships = (await UserMembership.find({ userId: duplicate._id }).lean()) as unknown as MigrationMembership[];
  const legacyRole = roleToMembership(duplicate.role);

  if (duplicate.schoolId && legacyRole) {
    duplicateMemberships.push({
      _id: new mongoose.Types.ObjectId(),
      userId: duplicate._id,
      schoolId: duplicate.schoolId,
      roles: [legacyRole],
      subroles: [],
      status: "active",
      createdAt: duplicate.createdAt,
      updatedAt: duplicate.updatedAt,
    });
  }

  for (const membership of duplicateMemberships) {
    const schoolId = objectId(membership.schoolId);
    const roles = (membership.roles || []).filter(isMembershipRole);
    const subroles = membership.subroles || [];
    const status = membership.status === "suspended" ? "suspended" : "active";
    operations.push(`membership ${String(schoolId)} roles=${roles.join(",") || "none"} status=${status}`);

    if (!apply) continue;

    await UserMembership.findOneAndUpdate(
      { userId: canonicalId, schoolId },
      {
        $set: { status },
        $setOnInsert: { userId: canonicalId, schoolId },
        ...(roles.length ? { $addToSet: { roles: { $each: roles } } } : {}),
        ...(subroles.length ? { $addToSet: { subroles: { $each: subroles } } } : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  if (apply) {
    await UserMembership.deleteMany({ userId: duplicate._id });
  }

  return operations;
}

async function mergeTeachers(canonicalId: Types.ObjectId, duplicateId: Types.ObjectId, apply: boolean) {
  const duplicateTeachers = await Teacher.find({ userId: duplicateId }).lean();
  const actions: string[] = [];

  for (const teacher of duplicateTeachers) {
    const schoolId = objectId((teacher as { schoolId: Types.ObjectId }).schoolId);
    const existing = await Teacher.findOne({ userId: canonicalId, schoolId }).select("_id").lean();
    if (existing) {
      actions.push(`delete duplicate teacher ${String(teacher._id)}; canonical teacher exists ${String(existing._id)}`);
      if (apply) {
        await mongoose.connection.db?.collection("teacherassignments").updateMany(
          { teacherId: teacher._id },
          { $set: { teacherId: existing._id } }
        );
        await mongoose.connection.db?.collection("classgroups").updateMany(
          { homeroomTeacherId: teacher._id },
          { $set: { homeroomTeacherId: existing._id } }
        );
        await Teacher.deleteOne({ _id: teacher._id });
      }
    } else {
      actions.push(`move teacher ${String(teacher._id)} to canonical user`);
      if (apply) {
        await Teacher.updateOne({ _id: teacher._id }, { $set: { userId: canonicalId } });
      }
    }
  }

  return actions;
}

async function mergeGuardians(canonicalId: Types.ObjectId, duplicateId: Types.ObjectId, apply: boolean) {
  const duplicateGuardians = await Guardian.find({ userId: duplicateId }).lean();
  const actions: string[] = [];

  for (const guardian of duplicateGuardians) {
    const studentId = objectId((guardian as { studentId: Types.ObjectId }).studentId);
    const existing = await Guardian.findOne({ userId: canonicalId, studentId }).select("_id").lean();
    if (existing) {
      actions.push(`delete duplicate guardian ${String(guardian._id)}; canonical guardian exists ${String(existing._id)}`);
      if (apply) await Guardian.deleteOne({ _id: guardian._id });
    } else {
      actions.push(`move guardian ${String(guardian._id)} to canonical user`);
      if (apply) {
        await Guardian.updateOne({ _id: guardian._id }, { $set: { userId: canonicalId } });
      }
    }
  }

  return actions;
}

async function getDuplicateGroups() {
  const rows = await User.aggregate<{ _id: string; userIds: Types.ObjectId[]; count: number }>([
    { $match: { email: { $type: "string", $ne: "" } } },
    { $group: { _id: { $toLower: "$email" }, userIds: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);

  return rows;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  await connectToDatabase();

  const groups = await getDuplicateGroups();
  console.log(`Duplicate email groups: ${groups.length}`);
  console.log(dryRun ? "Mode: dry-run. No writes will be made." : "Mode: apply. Data will be updated.");

  let duplicateUsers = 0;
  let deletedUsers = 0;

  for (const group of groups) {
    const users = (await User.find({ _id: { $in: group.userIds } })
      .sort({ updatedAt: -1 })
      .lean()) as UserDoc[];
    const canonical = pickCanonical(users);
    const duplicates = users.filter((user) => String(user._id) !== String(canonical._id));
    duplicateUsers += duplicates.length;

    console.log(`\n${group._id}`);
    console.log(`  canonical: ${String(canonical._id)} role=${canonical.role || "none"} schoolId=${canonical.schoolId ? String(canonical.schoolId) : "none"} clerk=${canonical.clerkUserId || "none"}`);

    const { set } = mergeUserSet(canonical, duplicates);
    if (Object.keys(set).length) {
      console.log(`  canonical profile update: set=${Object.keys(set).join(",")}`);
      if (apply) {
        const update: Record<string, unknown> = {};
        if (Object.keys(set).length) update.$set = set;
        await User.updateOne({ _id: canonical._id }, update);
      }
    }

    for (const duplicate of duplicates) {
      console.log(`  duplicate: ${String(duplicate._id)} role=${duplicate.role || "none"} schoolId=${duplicate.schoolId ? String(duplicate.schoolId) : "none"} clerk=${duplicate.clerkUserId || "none"}`);
      const memberships = await mergeMemberships(canonical._id, duplicate, apply);
      for (const action of memberships) console.log(`    ${action}`);

      const teacherActions = await mergeTeachers(canonical._id, duplicate._id, apply);
      for (const action of teacherActions) console.log(`    ${action}`);

      const guardianActions = await mergeGuardians(canonical._id, duplicate._id, apply);
      for (const action of guardianActions) console.log(`    ${action}`);

      const refCounts = dryRun
        ? await countRefs(duplicate._id)
        : await updateRefTargets(duplicate._id, canonical._id);
      for (const [target, count] of Object.entries(refCounts)) {
        console.log(`    ${dryRun ? "would update" : "updated"} ${target}: ${count}`);
      }

      if (apply) {
        await User.deleteOne({ _id: duplicate._id });
        deletedUsers++;
      }
    }
  }

  console.log("\nSummary");
  console.log(`  duplicate groups: ${groups.length}`);
  console.log(`  duplicate users to merge: ${duplicateUsers}`);
  console.log(`  users deleted: ${deletedUsers}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
