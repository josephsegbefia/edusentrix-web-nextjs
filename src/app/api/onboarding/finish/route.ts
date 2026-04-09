// src/app/api/onboarding/finish/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import connectToDatabase from "@/db/connectToDatabase";
import { User, IUser } from "@/models/User";
import { School, type ISchool } from "@/models/School";
import { enqueueSchoolPaymentProvisioning } from "@/lib/jobs/payment-provisioning";
import {
  deriveSchoolPaymentSetupStatus,
  hasCompleteSchoolBankDetails,
} from "@/lib/school-payments/payment-setup";

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

  const school = await School.findById(me.schoolId)
    .select("bank billing")
    .lean<Pick<ISchool, "bank" | "billing"> | null>();

  await Promise.all([
    User.updateOne(
      { clerkUserId: userId },
      { $set: { pendingOnboarding: false } }
    ),
    School.updateOne({ _id: me.schoolId }, { $set: { status: "active" } }),
  ]);

  if (
    school &&
    hasCompleteSchoolBankDetails(school) &&
    deriveSchoolPaymentSetupStatus(school) !== "review_required"
  ) {
    await enqueueSchoolPaymentProvisioning({
      schoolId: me.schoolId,
    });
  }

  return NextResponse.json({ ok: true });
}
