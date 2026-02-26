/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/admin/grades/[gradeId]/fees - Fee analytics for students in this grade
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Invoice } from "@/models/Invoice";
import mongoose from "mongoose";

const ACTIVE_INVOICE_STATUSES = ["issued", "partially_paid", "overdue", "paid"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gradeId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { gradeId } = await params;
    let gradeIdObj: mongoose.Types.ObjectId;
    try {
      gradeIdObj = new mongoose.Types.ObjectId(gradeId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid grade ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Get student IDs in this grade
    const students = await Student.find({
      schoolId: schoolIdObj,
      gradeId: gradeIdObj,
      status: { $in: ["active", "enrolled"] },
    })
      .select("_id classGroupId")
      .lean();

    const studentIds = students.map((s: any) => s._id);

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalBilledMinor: 0,
          totalPaidMinor: 0,
          totalOutstandingMinor: 0,
          collectionRate: 0,
          feeDefaultersCount: 0,
          invoiceCount: 0,
          studentCount: 0,
          byClass: [],
        },
      });
    }

    // Aggregate invoices for these students (non-draft, non-cancelled)
    const invoiceAgg = await Invoice.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          studentId: { $in: studentIds },
          status: { $nin: ["draft", "cancelled"] },
        },
      },
      {
        $group: {
          _id: null,
          totalBilled: { $sum: "$totalAmountMinor" },
          totalPaid: { $sum: "$totalPaidMinor" },
          totalOutstanding: { $sum: "$totalOutstandingMinor" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalBilledMinor = invoiceAgg[0]?.totalBilled ?? 0;
    const totalPaidMinor = invoiceAgg[0]?.totalPaid ?? 0;
    const totalOutstandingMinor = invoiceAgg[0]?.totalOutstanding ?? 0;
    const invoiceCount = invoiceAgg[0]?.count ?? 0;

    const collectionRate =
      totalBilledMinor > 0
        ? Math.round((totalPaidMinor / totalBilledMinor) * 10000) / 100
        : 0;

    // Fee defaulters: students with outstanding > 0
    const defaultersAgg = await Invoice.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          studentId: { $in: studentIds },
          status: { $in: ["issued", "partially_paid", "overdue"] },
          totalOutstandingMinor: { $gt: 0 },
        },
      },
      { $group: { _id: "$studentId" } },
      { $count: "count" },
    ]);
    const feeDefaultersCount = defaultersAgg[0]?.count ?? 0;

    // By class breakdown
    const studentIdToClass = new Map<string, mongoose.Types.ObjectId>();
    for (const s of students) {
      const sid = (s as any)._id;
      const cid = (s as any).classGroupId;
      if (sid && cid) studentIdToClass.set(String(sid), cid);
    }

    const byStudentAgg = await Invoice.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          studentId: { $in: studentIds },
          status: { $nin: ["draft", "cancelled"] },
        },
      },
      {
        $group: {
          _id: "$studentId",
          billed: { $sum: "$totalAmountMinor" },
          paid: { $sum: "$totalPaidMinor" },
          outstanding: { $sum: "$totalOutstandingMinor" },
        },
      },
    ]);

    const byClassMap = new Map<
      string,
      { billed: number; paid: number; outstanding: number; studentCount: number }
    >();

    for (const row of byStudentAgg) {
      const studentId = row._id;
      const classId = studentIdToClass.get(String(studentId));
      const key = classId ? String(classId) : "_unknown";
      const existing = byClassMap.get(key) ?? {
        billed: 0,
        paid: 0,
        outstanding: 0,
        studentCount: 0,
      };
      existing.billed += row.billed ?? 0;
      existing.paid += row.paid ?? 0;
      existing.outstanding += row.outstanding ?? 0;
      existing.studentCount += 1;
      byClassMap.set(key, existing);
    }

    // Resolve class names (full label: Grade + Class)
    const { ClassGroup } = await import("@/models/ClassGroup");
    const { Grade } = await import("@/models/Grade");
    const gradeDoc = await Grade.findById(gradeIdObj).select("name").lean();
    const gradeName = (gradeDoc as any)?.name ?? "";

    const classIds = Array.from(byClassMap.keys()).filter((k) => k !== "_unknown");
    const classDocs =
      classIds.length > 0
        ? await ClassGroup.find({
            _id: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
          })
            .select("_id name")
            .lean()
        : [];

    const classMap = new Map<string, string>();
    for (const c of classDocs) {
      const cname = (c as any).name ?? "Unknown";
      classMap.set(String((c as any)._id), gradeName ? `${gradeName} ${cname}` : cname);
    }

    const byClass = Array.from(byClassMap.entries()).map(([classId, data]) => ({
      classGroupId: classId,
      className: classId === "_unknown" ? "Unassigned" : classMap.get(classId) ?? classId,
      totalBilledMinor: data.billed,
      totalPaidMinor: data.paid,
      totalOutstandingMinor: data.outstanding,
      studentCount: data.studentCount,
      collectionRate:
        data.billed > 0 ? Math.round((data.paid / data.billed) * 10000) / 100 : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalBilledMinor,
        totalPaidMinor,
        totalOutstandingMinor,
        collectionRate,
        feeDefaultersCount,
        invoiceCount,
        studentCount: studentIds.length,
        byClass,
      },
    });
  } catch (e: unknown) {
    console.error("Error fetching grade fees:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch grade fees";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
