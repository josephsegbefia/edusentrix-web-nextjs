import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import connectToDatabase from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { School, type ISchool } from "@/models/School";
import { enqueueSchoolPaymentProvisioning } from "@/lib/jobs/payment-provisioning";
import {
  deriveSchoolPaymentSetupStatus,
  hasCompleteSchoolBankDetails,
} from "@/lib/school-payments/payment-setup";
import { applyLaunchCurriculum } from "@/lib/onboarding/launch-curriculum";
import { getOnboardingTargetSchoolAdmin } from "@/lib/onboarding/target-school-admin";
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

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = parsed.data;
  const periodList = body?.periods;

  await connectToDatabase();

  const schoolIdObj = new mongoose.Types.ObjectId(id);

  const target = await getOnboardingTargetSchoolAdmin(schoolIdObj);
  if (!target?._id) {
    return NextResponse.json(
      { error: "No school admin found for this school." },
      { status: 409 }
    );
  }

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
        { _id: target._id, schoolId: schoolIdObj },
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

  const school = await School.findById(schoolIdObj)
    .select("bank billing")
    .lean<Pick<ISchool, "bank" | "billing"> | null>();

  if (
    school &&
    hasCompleteSchoolBankDetails(school) &&
    deriveSchoolPaymentSetupStatus(school) !== "review_required"
  ) {
    await enqueueSchoolPaymentProvisioning({
      schoolId: schoolIdObj,
    });
  }

  return NextResponse.json({ ok: true });
}
