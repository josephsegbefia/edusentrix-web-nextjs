/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User } from "@/models/User";
import { School } from "@/models/School";
import { AcademicPeriod } from "@/models/AcademicPeriod";

const BodySchema = z.object({
  schoolId: z.string().min(1),
  subjects: z.array(z.string().min(1)).min(1),
  periods: z
    .array(
      z.object({
        yearLabel: z.string().min(1),
        term: z.string().min(1),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
        isCurrent: z.boolean().optional().default(false),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { schoolId, periods } = parsed.data;

  await connectToDatabase();

  const me = await User.findOne({ supabaseUserId: data.user.id });
  if (!me?.schoolId || String(me.schoolId) !== schoolId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Ensure exactly one current (if multiple flagged current, pick the last)
  let currentIdx = periods.findIndex((p) => p.isCurrent);
  if (currentIdx === -1) currentIdx = 0;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const school = await School.findById(me.schoolId).session(session);
    if (!school) {
      await session.abortTransaction();
      session.endSession();
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    // Upsert all periods (unique on schoolId+yearLabel+term)
    const inserts = [];
    let currentPeriodId: any = null;

    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const doc = await AcademicPeriod.findOneAndUpdate(
        {
          schoolId: school._id,
          yearLabel: p.yearLabel,
          term: p.term,
        },
        {
          $set: {
            startDate: new Date(p.startDate),
            endDate: new Date(p.endDate),
            isCurrent: false, // set below for the chosen one
          },
        },
        { new: true, upsert: true, session }
      );

      if (i === currentIdx) currentPeriodId = doc._id;
      inserts.push(doc);
    }

    if (currentPeriodId) {
      // Set the chosen period as current
      await AcademicPeriod.updateMany(
        { schoolId: school._id },
        { $set: { isCurrent: false } },
        { session }
      );
      await AcademicPeriod.findByIdAndUpdate(
        currentPeriodId,
        { $set: { isCurrent: true } },
        { session }
      );
    }

    // Activate school and set pointer
    school.status = "active";
    school.currentPeriodId = currentPeriodId ?? null;
    await school.save({ session });

    await session.commitTransaction();
    session.endSession();

    return NextResponse.json({ success: true });
  } catch (e) {
    await session.abortTransaction();
    session.endSession();
    console.error("[onboarding/finish] txn failed:", e);
    return NextResponse.json(
      { error: "Failed to finalize. Please try again later." },
      { status: 500 }
    );
  }
}
