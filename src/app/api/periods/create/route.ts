import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";

const bodySchema = z.object({
  yearLabel: z.string().min(1, "Year label is required"),
  term: z.string().min(1, "Term is required"),
  startDate: z.coerce
    .date()
    .min(new Date(), "Start date must be in the future"),
  endDate: z.coerce.date().min(new Date(), "End date must be in the future"),
  isYearEndTerminal: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const raw = await request.json();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { success: false, errors: parsed.error.flatten() },
      { status: 400 }
    );

  // set existing current to false
  await AcademicPeriod.updateMany(
    { schoolId, isCurrent: true },
    { $set: { isCurrent: false } }
  );

  if (parsed.data.isYearEndTerminal) {
    await AcademicPeriod.updateMany(
      { schoolId, yearLabel: parsed.data.yearLabel, isYearEndTerminal: true },
      { $set: { isYearEndTerminal: false } }
    );
  }

  const doc = await AcademicPeriod.create({
    schoolId,
    ...parsed.data,
    isCurrent: true,
  });

  return NextResponse.json({ success: true, period: doc }, { status: 201 });
}
