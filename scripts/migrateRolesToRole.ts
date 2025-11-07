/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Usage:
 * pnpm dlx tsx scripts/migrateRolesToRole.ts
 *
 * Env:
 *
 */

import "dotenv/config";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

const precedence = [
  "platform_admin",
  "school_admin",
  "staff",
  "non_teaching_staff",
  "teacher",
  "parent",
  "student",
] as const;

function pickRole(roles: unknown): string | null {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  const set = new Set(roles.map(String));
  for (const role of precedence) {
    if (set.has(role)) return role;
  }
  return typeof roles[0] === "string" ? roles[0] : null;
}

async function main() {
  await connectToDatabase();
  const cursor = User.find().lean().cursor();
  let updated = 0;

  for await (const doc of cursor) {
    const legacyRoles = (doc as any).roles;

    if (!legacyRoles || (doc as any).role) continue;

    const role = pickRole(legacyRoles) ?? "parent";
    await User.updateOne(
      { _id: doc._id },
      { $set: { role }, $unset: { roles: "" } }
    );
    updated++;
  }

  console.log("Migration complete. Updated ${updated} users.");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
