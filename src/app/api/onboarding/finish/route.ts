// src/app/api/onboarding/finish/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import mongoose from "mongoose";
import connectToDatabase from "@/db/connectToDatabase";
import { User, IUser } from "@/models/User";
import { School, type ISchool } from "@/models/School";
import { enqueueSchoolPaymentProvisioning } from "@/lib/jobs/payment-provisioning";
import {
  deriveSchoolPaymentSetupStatus,
  hasCompleteSchoolBankDetails,
} from "@/lib/school-payments/payment-setup";
import { applyLaunchCurriculum } from "@/lib/onboarding/launch-curriculum";
import { runMongoTransaction } from "@/lib/mongoose/run-transaction";

const BodySchema = z
  .object({
    periods: z
      .array(
        z.object({
          yearLabel: z.string().min(1),
          term: z.string().min(1),
          startDate: z.string().min(1),
          endDate: z.string().min(1),
          isCurrent: z.boolean().optional(),
          isYearEndTerminal: z.boolean().optional(),
        })
      )
      .optional(),
  })
  .optional();

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = parsed.data;
  const periodList = body?.periods;

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

  const schoolIdObj =
    me.schoolId instanceof mongoose.Types.ObjectId
      ? me.schoolId
      : new mongoose.Types.ObjectId(String(me.schoolId));

  try {
    await runMongoTransaction(async (session) => {
      if (periodList && periodList.length > 0) {
        await applyLaunchCurriculum(
          schoolIdObj,
          {
            periods: periodList ?? [],
          },
          { session }
        );
      }

      await User.updateOne(
        { clerkUserId: userId },
        { $set: { pendingOnboarding: false } },
        { session }
      );
      await School.updateOne(
        { _id: schoolIdObj },
        {
          $set: {
            status: "active",
            "onboarding.finishedAt": new Date(),
          },
        },
        { session }
      );
    });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Failed to finalize onboarding";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const school = await School.findById(me.schoolId)
    .select("bank billing")
    .lean<Pick<ISchool, "bank" | "billing"> | null>();

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
