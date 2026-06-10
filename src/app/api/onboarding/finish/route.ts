// src/app/api/onboarding/finish/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import connectToDatabase from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { School, type ISchool } from "@/models/School";
import { enqueueSchoolPaymentProvisioning } from "@/lib/jobs/payment-provisioning";
import {
  deriveSchoolPaymentSetupStatus,
  hasCompleteSchoolBankDetails,
} from "@/lib/school-payments/payment-setup";
import { applyLaunchCurriculum } from "@/lib/onboarding/launch-curriculum";
import { runMongoTransaction } from "@/lib/mongoose/run-transaction";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";
import { gateSchoolAdminRoles } from "@/lib/auth/role-gates";

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
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const body = parsed.data;
  const periodList = body?.periods;

  const active = await resolveActiveSchoolContext({ clerkUserId: userId });
  if (!active.ok) {
    return NextResponse.json(
      {
        error:
          active.reason === "needs_school_selection"
            ? "School selection required"
            : "No linked school",
      },
      { status: active.reason === "needs_school_selection" ? 409 : 400 }
    );
  }

  const adminGate = gateSchoolAdminRoles(active.context.roles);
  if (!adminGate.ok) {
    return NextResponse.json({ error: "School admin access required" }, { status: 403 });
  }

  const schoolIdObj = active.context.schoolId;

  await connectToDatabase();

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
        { _id: active.context.userId },
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
