/**
 * Dev/staging smoke checks for multi-tenant identity invariants.
 *
 * Usage:
 *   npx tsx scripts/verify-multi-tenant-identity.ts
 *   npx tsx scripts/verify-multi-tenant-identity.ts --verbose
 */
import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";

loadEnv({ path: ".env.local", quiet: true });

type Issue = { level: "error" | "warn"; message: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function main() {
  const verbose = process.argv.includes("--verbose");
  const issues: Issue[] = [];

  await connectToDatabase();

  const duplicateClerkIds = await User.aggregate<{ _id: string; count: number }>([
    { $match: { clerkUserId: { $type: "string", $ne: "" } } },
    { $group: { _id: "$clerkUserId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  if (duplicateClerkIds.length > 0) {
    issues.push({
      level: "error",
      message: `${duplicateClerkIds.length} duplicate clerkUserId value(s) found`,
    });
    if (verbose) {
      for (const row of duplicateClerkIds) {
        console.log(`  clerkUserId=${row._id} count=${row.count}`);
      }
    }
  }

  const users = await User.find({ email: { $exists: true, $ne: "" } })
    .select("email clerkUserId schoolId role pendingOnboarding")
    .lean<
      Array<{
        _id: mongoose.Types.ObjectId;
        email: string;
        clerkUserId?: string;
        schoolId?: mongoose.Types.ObjectId | null;
        role?: string | null;
        pendingOnboarding?: boolean;
      }>
    >();

  const byEmail = new Map<string, typeof users>();
  for (const user of users) {
    const key = normalizeEmail(user.email);
    const bucket = byEmail.get(key) || [];
    bucket.push(user);
    byEmail.set(key, bucket);
  }

  let duplicateEmailGroups = 0;
  for (const [email, group] of byEmail.entries()) {
    if (group.length <= 1) continue;
    duplicateEmailGroups += 1;
    issues.push({
      level: "error",
      message: `Duplicate User docs for email ${email} (${group.length} rows)`,
    });
    if (verbose) {
      for (const user of group) {
        console.log(
          `  userId=${String(user._id)} clerk=${user.clerkUserId || "-"} schoolId=${user.schoolId ? String(user.schoolId) : "null"} role=${user.role || "-"}`
        );
      }
    }
  }

  const orphanOnboarding = await User.countDocuments({
    pendingOnboarding: true,
    schoolId: null,
    clerkUserId: { $exists: true, $ne: null },
  });
  if (orphanOnboarding > 0) {
    issues.push({
      level: "warn",
      message: `${orphanOnboarding} onboarding placeholder user(s) with schoolId:null`,
    });
  }

  const usersWithoutMembership = await User.aggregate<{ count: number }>([
    {
      $lookup: {
        from: "usermemberships",
        localField: "_id",
        foreignField: "userId",
        as: "memberships",
      },
    },
    {
      $match: {
        role: { $nin: ["platform_admin", null] },
        memberships: { $size: 0 },
      },
    },
    { $count: "count" },
  ]);
  const noMembershipCount = usersWithoutMembership[0]?.count ?? 0;
  if (noMembershipCount > 0) {
    issues.push({
      level: "warn",
      message: `${noMembershipCount} non-platform user(s) have no UserMembership rows`,
    });
  }

  const membershipStats = await UserMembership.aggregate<{
    _id: string;
    count: number;
  }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log("Multi-tenant identity verification");
  console.log(`Users: ${users.length}`);
  console.log(`Duplicate email groups: ${duplicateEmailGroups}`);
  console.log(
    `Memberships: ${membershipStats.map((row) => `${row._id}=${row.count}`).join(", ") || "none"}`
  );

  if (issues.length === 0) {
    console.log("OK — no blocking identity issues detected.");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log("");
  for (const issue of issues) {
    console.log(`[${issue.level.toUpperCase()}] ${issue.message}`);
  }

  const hasErrors = issues.some((issue) => issue.level === "error");
  await mongoose.disconnect();
  process.exit(hasErrors ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
