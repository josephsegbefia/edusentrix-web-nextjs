// src/app/api/parent/payments/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { Payment } from "@/models/Payment";
import { Invoice } from "@/models/Invoice";

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const wardId = searchParams.get("wardId");
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    // Get all wards for this parent
    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: {
          payments: [],
          summary: {
            totalPayments: 0,
            totalAmount: 0,
            thisMonthAmount: 0,
            thisYearAmount: 0,
          },
          pagination: { total: 0, limit, offset, hasMore: false },
        },
      });
    }

    let studentIds = guardians.map(
      (g) => (g as unknown as { studentId: mongoose.Types.ObjectId }).studentId
    );

    // Filter by specific ward if provided
    if (wardId && mongoose.Types.ObjectId.isValid(wardId)) {
      const wardObjectId = new mongoose.Types.ObjectId(wardId);
      if (studentIds.some((id) => id.equals(wardObjectId))) {
        studentIds = [wardObjectId];
      }
    }

    // Fetch students for name mapping
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName")
      .lean();

    const studentMap = new Map(
      students.map((s: any) => [
        String(s._id),
        `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      ])
    );

    // Build query filters
    const filter: any = {
      studentId: { $in: studentIds },
      schoolId: context.schoolId,
      status: "completed",
    };

    // Date filters
    if (year && month) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);
      filter.paymentDate = { $gte: startDate, $lte: endDate };
    } else if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31);
      filter.paymentDate = { $gte: startDate, $lte: endDate };
    }

    // Get total count
    const totalCount = await Payment.countDocuments(filter);

    // Fetch payments
    const payments = await Payment.find(filter)
      .select("studentId amount paymentDate paymentMethod reference invoiceId notes")
      .sort({ paymentDate: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Get invoice titles
    const invoiceIds = payments.map((p: any) => p.invoiceId).filter(Boolean);
    const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
      .select("_id title")
      .lean();
    const invoiceMap = new Map(
      invoices.map((inv: any) => [String(inv._id), inv.title])
    );

    // Format payments
    const formattedPayments = payments.map((p: any) => ({
      id: String(p._id),
      wardId: String(p.studentId),
      wardName: studentMap.get(String(p.studentId)) || "Unknown",
      amount: p.amount || 0,
      date: p.paymentDate?.toISOString() || "",
      method: p.paymentMethod || "cash",
      reference: p.reference || "",
      invoiceTitle: p.invoiceId ? invoiceMap.get(String(p.invoiceId)) || "School Fees" : "School Fees",
      notes: p.notes || "",
    }));

    // Calculate summaries
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisYearStart = new Date(now.getFullYear(), 0, 1);

    const allPayments = await Payment.find({
      studentId: { $in: studentIds },
      schoolId: context.schoolId,
      status: "completed",
    })
      .select("amount paymentDate")
      .lean();

    let totalAmount = 0;
    let thisMonthAmount = 0;
    let thisYearAmount = 0;

    allPayments.forEach((p: any) => {
      const amount = p.amount || 0;
      const date = new Date(p.paymentDate);
      totalAmount += amount;
      if (date >= thisYearStart) thisYearAmount += amount;
      if (date >= thisMonthStart) thisMonthAmount += amount;
    });

    return NextResponse.json({
      success: true,
      data: {
        payments: formattedPayments,
        wards: students.map((s: any) => ({
          id: String(s._id),
          name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        })),
        summary: {
          totalPayments: allPayments.length,
          totalAmount,
          thisMonthAmount,
          thisYearAmount,
        },
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent payments:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payments",
      },
      { status: 500 }
    );
  }
}
