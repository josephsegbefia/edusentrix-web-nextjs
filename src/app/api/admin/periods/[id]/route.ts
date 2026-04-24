// src/app/api/admin/periods/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";

const updateBodySchema = z
  .object({
    yearLabel: z.string().trim().min(1, "Year label is required").optional(),
    term: z.string().trim().min(1, "Term is required").optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isCurrent: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.yearLabel !== undefined ||
      data.term !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.isCurrent === true,
    {
      message: "No valid update fields provided",
    }
  );

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid period ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update payload" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));
    const periodIdObj = new mongoose.Types.ObjectId(id);

    const period = await AcademicPeriod.findOne({
      _id: periodIdObj,
      schoolId: schoolIdObj,
    });

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const nextStartDate = parsed.data.startDate ?? new Date(period.startDate);
    const nextEndDate = parsed.data.endDate ?? new Date(period.endDate);

    if (nextEndDate < nextStartDate) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 }
      );
    }

    if (
      parsed.data.startDate !== undefined ||
      parsed.data.endDate !== undefined
    ) {
      const overlaps = await AcademicPeriod.find({
        schoolId: schoolIdObj,
        _id: { $ne: periodIdObj },
      })
        .select("startDate endDate")
        .lean();

      const hasOverlap = overlaps.some((other) =>
        rangesOverlap(
          nextStartDate,
          nextEndDate,
          new Date(other.startDate),
          new Date(other.endDate)
        )
      );

      if (hasOverlap) {
        return NextResponse.json(
          {
            error: "This period overlaps with an existing period. Adjust the dates.",
          },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.yearLabel !== undefined) {
      updateData.yearLabel = parsed.data.yearLabel;
    }
    if (parsed.data.term !== undefined) {
      updateData.term = parsed.data.term;
    }
    if (parsed.data.startDate !== undefined) {
      updateData.startDate = parsed.data.startDate;
    }
    if (parsed.data.endDate !== undefined) {
      updateData.endDate = parsed.data.endDate;
    }
    if (parsed.data.isCurrent === true) {
      await AcademicPeriod.updateMany(
        { schoolId: schoolIdObj, isCurrent: true },
        { $set: { isCurrent: false } }
      );
      updateData.isCurrent = true;
    }

    if (Object.keys(updateData).length > 0) {
      period.set(updateData);
      await period.save();
    }

    return NextResponse.json({
      success: true,
      period: {
        id: String(period._id),
        yearLabel: period.yearLabel,
        term: period.term,
        startDate: period.startDate,
        endDate: period.endDate,
        isCurrent: period.isCurrent,
      },
    });
  } catch (error) {
    console.error("Error updating period:", error);
    return NextResponse.json(
      { error: "Failed to update period" },
      { status: 500 }
    );
  }
}
