// src/app/api/admin/periods/[id]/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Invoice } from "@/models/Invoice";
import { Assessment } from "@/models/Assessment";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TimetableVersion } from "@/models/TimetableVersion";
import { StudentClassRole } from "@/models/StudentClassRole";
import { Payment } from "@/models/Payment";

export async function GET(
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

    const [
      invoiceCount,
      assessmentCount,
      teacherAssignmentCount,
      timetableVersionCount,
      studentRoleCount,
      revenueAgg,
    ] = await Promise.all([
      Invoice.countDocuments({
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
        status: { $ne: "cancelled" },
      }),
      Assessment.countDocuments({
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
      }),
      TeacherAssignment.countDocuments({
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
        status: "active",
      }),
      TimetableVersion.countDocuments({
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
      }),
      StudentClassRole.countDocuments({
        schoolId: schoolIdObj,
        academicPeriodId: periodIdObj,
      }),
      Payment.aggregate([
        {
          $match: {
            schoolId: schoolIdObj,
            status: "completed",
          },
        },
        {
          $lookup: {
            from: "invoices",
            localField: "invoiceId",
            foreignField: "_id",
            as: "invoice",
          },
        },
        { $unwind: "$invoice" },
        {
          $match: {
            "invoice.academicPeriodId": periodIdObj,
          },
        },
        { $group: { _id: null, total: { $sum: "$amountMinor" } } },
      ]),
    ]);

    const revenueMinor = revenueAgg[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        period: {
          id: String(period._id),
          yearLabel: period.yearLabel,
          term: period.term,
          startDate: period.startDate,
          endDate: period.endDate,
          isCurrent: period.isCurrent,
        },
        counts: {
          invoices: invoiceCount,
          assessments: assessmentCount,
          teacherAssignments: teacherAssignmentCount,
          timetableVersions: timetableVersionCount,
          studentRoles: studentRoleCount,
        },
        revenueMinor,
      },
    });
  } catch (error) {
    console.error("Error fetching period summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch period summary" },
      { status: 500 }
    );
  }
}
