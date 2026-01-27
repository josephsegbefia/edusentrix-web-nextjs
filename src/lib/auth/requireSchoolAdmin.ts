import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, IUser } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { NextResponse } from "next/server";

function legacyRoleToArray(role?: string) {
  if (role === "school_admin") return ["school_admin"];
  if (role === "teacher") return ["teacher"];
  return ["staff"];
}

export async function requireSchoolAdmin() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId)
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const userRaw = await User.findOne({ clerkUserId }).lean();
  const userNormalized = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const user = userNormalized as Pick<
    IUser,
    "_id" | "schoolId" | "role"
  > | null;
  if (!user)
    throw NextResponse.json({ error: "User not found" }, { status: 401 });

  // Try membership
  let membership = await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  });
  // auto-backfill (dev friendly)
  if (!membership && user.schoolId) {
    membership = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
  }

  const roles = membership?.roles || [];
  const isAdmin = roles.includes("school_admin");
  if (!isAdmin)
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return { userId: user._id, schoolId: user.schoolId };
}
