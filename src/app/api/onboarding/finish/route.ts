import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { User } from "@/models/User";
import { School } from "@/models/School";
import { Subject } from "@/models/Subject";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Invite } from "@/models/Invite";
import { startSession } from "mongoose";

const BodySchema = z.object({
  schoolId: z.string().min(1),
  subjects: z.array(z.string().min(1)).min(1),
  periods: z
    .array(
      z.object({
        yearLabel: z.string().min(1),
        term: z.string().min(1),
        startDate: z.string().datetime(), // ISO
        endDate: z.string().datetime(),
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
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  await connectToDatabase();

  const user = await User.findOne({ supabaseUserId: data.user.id });
  if (!user?.schoolId)
    return NextResponse.json({ error: "No school bound" }, { status: 409 });
  if (String(user.schoolId) !== parsed.data.schoolId) {
    return NextResponse.json(
      { error: "Forbidden for this school" },
      { status: 403 }
    );
  }

  const school = await School.findById(user.schoolId);
  if (!school)
    return NextResponse.json({ error: "School not found" }, { status: 404 });

  const session = await startSession();
  try {
    session.startTransaction();

    // Upsert subjects
    const uniq = Array.from(
      new Set(parsed.data.subjects.map((s) => s.trim()).filter(Boolean))
    );
    if (uniq.length === 0) throw new Error("No valid subjects");

    for (const name of uniq) {
      await Subject.updateOne(
        { schoolId: school._id, name },
        {
          $setOnInsert: { schoolId: school._id, name, isActive: true },
          $set: { isActive: true },
        },
        { upsert: true, session, collation: { locale: "en", strength: 2 } }
      );
    }

    // Replace periods (simple approach)
    await AcademicPeriod.deleteMany({ schoolId: school._id }, { session });
    await AcademicPeriod.insertMany(
      parsed.data.periods.map((p) => ({
        schoolId: school._id,
        yearLabel: p.yearLabel,
        term: p.term,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        isCurrent: !!p.isCurrent,
      })),
      { session }
    );

    // Ensure single current period
    const anyCurrent = parsed.data.periods.some((p) => p.isCurrent);
    if (!anyCurrent) {
      await AcademicPeriod.updateOne(
        { schoolId: school._id },
        { $set: { isCurrent: true } },
        { session }
      );
    } else {
      // Enforce only one current
      const current = await AcademicPeriod.find(
        { schoolId: school._id },
        null,
        { session }
      ).sort({ createdAt: 1 });
      let marked = false;
      for (const ap of current) {
        if (ap.isCurrent && !marked) {
          marked = true;
        } else if (ap.isCurrent && marked) {
          ap.isCurrent = false;
          await ap.save({ session });
        }
      }
    }

    // Finalize school + user + invite
    school.status = "active";
    await school.save({ session });

    // Assign role if missing
    if (!user.roles.includes("school_admin")) user.roles.push("school_admin");
    user.pendingOnboarding = false;
    await user.save({ session });

    // Mark latest pending invite accepted for this email/school (if any)
    await Invite.updateOne(
      {
        email: user.email.toLowerCase(),
        schoolId: school._id,
        status: "pending",
        expiresAt: { $gt: new Date() },
      },
      { $set: { status: "accepted" } },
      { session }
    );

    await session.commitTransaction();
    return NextResponse.json({ success: true });
  } catch (err) {
    await session.abortTransaction();
    return NextResponse.json(
      { error: "Finalize failed", details: `${err}` },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
