// src/app/api/admin/periods/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";

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
    const isCurrent = body.isCurrent === true;

    if (!isCurrent) {
      return NextResponse.json(
        { error: "Only isCurrent: true is supported" },
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
    }).lean();

    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    await AcademicPeriod.updateMany(
      { schoolId: schoolIdObj, isCurrent: true },
      { $set: { isCurrent: false } }
    );

    await AcademicPeriod.updateOne(
      { _id: periodIdObj, schoolId: schoolIdObj },
      { $set: { isCurrent: true } }
    );

    return NextResponse.json({
      success: true,
      period: {
        id: String(period._id),
        yearLabel: period.yearLabel,
        term: period.term,
        startDate: period.startDate,
        endDate: period.endDate,
        isCurrent: true,
      },
    });
  } catch (error) {
    console.error("Error setting current period:", error);
    return NextResponse.json(
      { error: "Failed to set current period" },
      { status: 500 }
    );
  }
}
