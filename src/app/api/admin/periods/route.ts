// src/app/api/admin/periods/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import {
  requireSchoolAdminOrDelegatedModuleView,
  requireSchoolAdminOrDelegatedAnyPermission,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { academicPeriodPastDateError } from "@/lib/academic-periods/date-guard";

const createBodySchema = z.object({
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

export async function GET(req: NextRequest) {
  let schoolId: mongoose.Types.ObjectId;
  try {
    const ctx = await requireSchoolAdminOrTeacherRead();
    schoolId = ctx.schoolId;
  } catch (err) {
    if (!(err instanceof Response)) throw err;
    if (err.status === 401) throw err;
    const d = await requireSchoolAdminOrDelegatedModuleView("academic_periods");
    schoolId = d.schoolId;
  }
  await connectToDatabase();

  try {
    const periods = await AcademicPeriod.find({ schoolId })
      .sort({ startDate: -1 })
      .lean();

    return NextResponse.json({ periods });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching academic periods:", error);
    return NextResponse.json(
      { error: "Failed to fetch academic periods" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let schoolId: mongoose.Types.ObjectId;
    try {
      const ctx = await requireFinanceStaff();
      schoolId = ctx.schoolId;
    } catch (err) {
      if (!(err instanceof Response)) throw err;
      if (err.status === 401) throw err;
      const d = await requireSchoolAdminOrDelegatedAnyPermission([
        "academic_periods.edit",
      ]);
      schoolId = d.schoolId;
    }
    await connectToDatabase();

    const raw = await req.json();
    const parsed = createBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { yearLabel, term, startDate, endDate } = parsed.data;
    const pastDateError = academicPeriodPastDateError({ startDate, endDate });
    if (pastDateError) {
      return NextResponse.json(
        { success: false, error: pastDateError },
        { status: 400 }
      );
    }

    const isYearEndTerminal = parsed.data.isYearEndTerminal ?? false;
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const existing = await AcademicPeriod.find({ schoolId: schoolIdObj }).lean();
    const overlaps = existing.some((p) => {
      const pStart = new Date(p.startDate);
      const pEnd = new Date(p.endDate);
      return rangesOverlap(startDate, endDate, pStart, pEnd);
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

    await AcademicPeriod.updateMany(
      { schoolId: schoolIdObj, isCurrent: true },
      { $set: { isCurrent: false } }
    );

    if (isYearEndTerminal) {
      await AcademicPeriod.updateMany(
        { schoolId: schoolIdObj, yearLabel, isYearEndTerminal: true },
        { $set: { isYearEndTerminal: false } }
      );
    }

    const doc = await AcademicPeriod.create({
      schoolId: schoolIdObj,
      yearLabel,
      term,
      startDate,
      endDate,
      isCurrent: true,
      isYearEndTerminal,
    });

    return NextResponse.json(
      {
        success: true,
        period: {
          id: String(doc._id),
          yearLabel: doc.yearLabel,
          term: doc.term,
          startDate: doc.startDate,
          endDate: doc.endDate,
          isCurrent: doc.isCurrent,
          isYearEndTerminal: doc.isYearEndTerminal,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating academic period:", error);
    return NextResponse.json(
      { error: "Failed to create academic period" },
      { status: 500 }
    );
  }
}
