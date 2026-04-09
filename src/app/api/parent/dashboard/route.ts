import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { toMajorUnits } from "@/lib/fees/money";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { Invoice } from "@/models/Invoice";
import { ClassGroup } from "@/models/ClassGroup";

type GuardianLink = {
  studentId: mongoose.Types.ObjectId;
  relationship?: string;
  isPrimary?: boolean;
};

type StudentRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  photoUrl?: string | null;
  status?: string;
  classGroupId?: mongoose.Types.ObjectId;
  admissionNo?: string | null;
};

type ClassGroupRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
};

type InvoiceSummaryRow = {
  _id: mongoose.Types.ObjectId;
  totalPaidMinor?: number;
  outstandingMinor?: number;
  pendingInvoices?: number;
};

export async function GET() {
  try {
    const context = await requireParent();
    await connectToDatabase();

    // Get all wards for this parent
    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId relationship isPrimary")
      .lean<GuardianLink[]>();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: {
          wards: [],
          summary: {
            totalWards: 0,
            totalOutstanding: 0,
            upcomingPayments: 0,
          },
        },
      });
    }

    const studentIds = guardians.map((g) => g.studentId);

    // Fetch students
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName middleName photoUrl status classGroupId admissionNo")
      .lean<StudentRow[]>();

    // Get class group names
    const classGroupIds = students
      .map((s) => s.classGroupId)
      .filter((classGroupId): classGroupId is mongoose.Types.ObjectId => Boolean(classGroupId));
    
    const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name")
      .lean<ClassGroupRow[]>();
    
    const classGroupMap = new Map(
      classGroups.map((cg) => [String(cg._id), cg.name || ""])
    );

    // Get fee summaries for all wards
    const invoiceSummary = await Invoice.aggregate<InvoiceSummaryRow>([
      {
        $match: {
          studentId: { $in: studentIds },
          schoolId: context.schoolId,
          status: { $nin: ["draft", "cancelled"] },
        },
      },
      {
        $group: {
          _id: "$studentId",
          totalPaidMinor: { $sum: "$totalPaidMinor" },
          outstandingMinor: { $sum: "$totalOutstandingMinor" },
          pendingInvoices: {
            $sum: {
              $cond: [
                { $gt: ["$totalOutstandingMinor", 0] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const invoiceMap = new Map(
      invoiceSummary.map((s) => [
        String(s._id),
        {
          totalPaid: toMajorUnits(Number(s.totalPaidMinor || 0)),
          outstanding: toMajorUnits(Number(s.outstandingMinor || 0)),
          pendingInvoices: s.pendingInvoices || 0,
        },
      ])
    );

    // Build guardian relationship map
    const guardianMap = new Map(
      guardians.map((g) => [
        String(g.studentId),
        { relationship: g.relationship, isPrimary: g.isPrimary },
      ])
    );

    // Calculate totals
    let totalOutstanding = 0;
    let upcomingPayments = 0;
    const wards = students.map((student) => {
      const invoice = invoiceMap.get(String(student._id)) || {
        totalPaid: 0,
        outstanding: 0,
        pendingInvoices: 0,
      };
      totalOutstanding += invoice.outstanding;
      upcomingPayments += invoice.pendingInvoices;

      const guardianInfo = guardianMap.get(String(student._id));
      const feeStatus: "clear" | "partial" | "owing" =
        invoice.outstanding <= 0
          ? "clear"
          : invoice.totalPaid > 0
          ? "partial"
          : "owing";

      return {
        id: String(student._id),
        name: `${student.firstName || ""} ${student.middleName || ""} ${student.lastName || ""}`.replace(/\s+/g, " ").trim(),
        firstName: student.firstName,
        lastName: student.lastName,
        photoUrl: student.photoUrl || null,
        classGroup: classGroupMap.get(String(student.classGroupId)) || "",
        classGroupId: String(student.classGroupId || ""),
        admissionNo: student.admissionNo || null,
        status: student.status,
        relationship: guardianInfo?.relationship || "guardian",
        isPrimary: guardianInfo?.isPrimary || false,
        feeStatus,
        outstandingAmount: invoice.outstanding,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        wards,
        summary: {
          totalWards: wards.length,
          totalOutstanding,
          upcomingPayments,
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard",
      },
      { status: 500 }
    );
  }
}
