/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User, type IUser } from "@/models/User";
import { School } from "@/models/School";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ProvisioningJob } from "@/models/ProvisioningJob";

const PeriodSchema = z.object({
  yearLabel: z.string().min(1),
  term: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isCurrent: z.boolean().optional().default(false),
});

const BodySchema = z.object({
  schoolId: z.string().min(1),
  subjects: z.array(z.string().min(1)).min(1), // (Optionally create subject docs later)
  periods: z.array(PeriodSchema).min(1),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();

  const meResult = await User.findOne({ clerkUserId: data.user.id }).lean();
  const me = meResult as IUser | null;
  if (!me?.schoolId)
    return NextResponse.json({ error: "No school bound" }, { status: 409 });
  if (String(me.schoolId) !== parsed.data.schoolId) {
    return NextResponse.json(
      { error: "Forbidden for this school" },
      { status: 403 }
    );
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const school = await School.findById(me.schoolId).session(session);
    if (!school) throw new Error("School not found");

    // Upsert AcademicPeriods (idempotent by unique index on schoolId+yearLabel+term)
    // We also normalize "current" — only the latest flagged is kept as current
    const flagged = parsed.data.periods.filter((p) => p.isCurrent);
    const currentKey = flagged.length
      ? `${flagged[flagged.length - 1].yearLabel}__${
          flagged[flagged.length - 1].term
        }`
      : null;

    // First, clear all currents for this school
    await AcademicPeriod.updateMany(
      { schoolId: school._id, isCurrent: true },
      { $set: { isCurrent: false } },
      { session }
    );

    for (const p of parsed.data.periods) {
      const filter = {
        schoolId: school._id,
        yearLabel: p.yearLabel,
        term: p.term,
      };
      const update = {
        $set: {
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
          isCurrent: currentKey === `${p.yearLabel}__${p.term}`,
        },
      };
      await AcademicPeriod.updateOne(filter, update, { upsert: true, session });
    }

    // Mark school active + onboarding stamp
    school.status = "active";
    school.onboarding = { finishedAt: new Date() };
    await school.save({ session });

    // Enqueue Paystack provisioning job iff we have bank details + not yet provisioned
    const acctNo = school.bank?.accountNumber;
    const bankCode = school.bank?.sortCode;
    const alreadyProvisioned = !!school.billing?.paystack?.subaccountCode;

    if (acctNo && bankCode && !alreadyProvisioned) {
      // Idempotent: don't create another pending job if one exists
      const exists = await ProvisioningJob.findOne({
        kind: "paystack_subaccount",
        schoolId: school._id,
        status: { $in: ["pending", "running", "failed"] },
      })
        .session(session)
        .lean();

      if (!exists) {
        await ProvisioningJob.create(
          [
            {
              kind: "paystack_subaccount",
              schoolId: school._id,
              status: "pending",
              attempts: 0,
              nextRunAt: new Date(), // eligible immediately
            },
          ],
          { session }
        );
      }
    }

    await session.commitTransaction();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    await session.abortTransaction();
    return NextResponse.json(
      {
        error: "Failed to finalize onboarding",
        details: e?.message || String(e),
      },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
