// src/app/api/onboarding/finish/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectToDatabase from "@/db/connectToDatabase";
import { User, IUser } from "@/models/User";
import { School } from "@/models/School";

export async function POST() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();
  const meRaw = await User.findOne({ clerkUserId: userId })
    .select("schoolId")
    .lean();
  const me = (Array.isArray(meRaw) ? meRaw[0] : meRaw) as Pick<
    IUser,
    "schoolId"
  > | null;
  if (!me?.schoolId)
    return NextResponse.json({ error: "No linked school" }, { status: 400 });

  await Promise.all([
    User.updateOne(
      { clerkUserId: userId },
      { $set: { pendingOnboarding: false } }
    ),
    School.updateOne({ _id: me.schoolId }, { $set: { status: "active" } }),
  ]);

  return NextResponse.json({ ok: true });
}
