import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";

const bodySchema = z.object({
  yearLabel: z.string().min(1, "Year label is required"),
  term: z.string().min(1, "Term is required"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isYearEndTerminal: z.boolean().optional().default(false),
}).refine((data) => data.endDate >= data.startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
});

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

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

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const existing = await AcademicPeriod.find({ schoolId: schoolIdObj }).lean();
  const overlaps = existing.some((period) => {
    const periodStart = new Date(period.startDate);
    const periodEnd = new Date(period.endDate);
    return rangesOverlap(
      parsed.data.startDate,
      parsed.data.endDate,
      periodStart,
      periodEnd
    );
  });

  if (overlaps) {
    return NextResponse.json(
      {
        success: false,
        error: "This period overlaps with an existing period. Adjust the dates.",
      },
      { status: 400 }
    );
  }

  // set existing current to false
  await AcademicPeriod.updateMany(
    { schoolId: schoolIdObj, isCurrent: true },
    { $set: { isCurrent: false } }
  );

  if (parsed.data.isYearEndTerminal) {
    await AcademicPeriod.updateMany(
      {
        schoolId: schoolIdObj,
        yearLabel: parsed.data.yearLabel,
        isYearEndTerminal: true,
      },
      { $set: { isYearEndTerminal: false } }
    );
  }

  const doc = await AcademicPeriod.create({
    schoolId: schoolIdObj,
    ...parsed.data,
    isCurrent: true,
  });

  return NextResponse.json({ success: true, period: doc }, { status: 201 });
}
