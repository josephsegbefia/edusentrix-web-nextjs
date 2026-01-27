/* eslint-disable @typescript-eslint/no-explicit-any */
// scripts/backfill-memberships.ts
import "dotenv/config";
import mongoose from "mongoose";

import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import connectToDatabase from "@/db/connectToDatabase";

const ROLE_MAP = (legacy?: string) => {
  if (!legacy) return ["staff"];
  if (legacy === "school_admin") return ["school_admin"];
  if (legacy === "teacher") return ["teacher"];
  return ["staff"];
};

(async () => {
  await connectToDatabase();

  const cursor = User.find({ schoolId: { $exists: true, $ne: null } }).cursor();
  let created = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const has = await UserMembership.findOne({
      userId: doc._id,
      schoolId: doc.schoolId,
    }).lean();
    if (!has) {
      await UserMembership.create({
        userId: doc._id,
        schoolId: doc.schoolId,
        roles: ROLE_MAP((doc as any).role),
        status: "active",
      });
      created++;
    }
  }
  console.log(`Created ${created} memberships`);
  await mongoose.disconnect();
})();
