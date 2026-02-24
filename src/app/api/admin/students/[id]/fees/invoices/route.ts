/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/[id]/fees/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { Student } from "@/models/Student";

const ACTIVE_INVOICE_STATUSES = new Set([
  "issued",
  "partially_paid",
  "paid",
  "overdue",
]);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { id: studentId } = await ctx.params;
    const { searchParams } = new URL(req.url);

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: 400 }
      );
    }

    // Verify student exists and belongs to school
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(studentId),
      schoolId,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Parse query parameters
    const academicPeriodId = searchParams.get("academicPeriodId");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    if (academicPeriodId && !mongoose.Types.ObjectId.isValid(academicPeriodId)) {
      return NextResponse.json(
        { error: "Invalid academic period ID" },
        { status: 400 }
      );
    }

    // Build query
    const query: any = {
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
    };

    if (academicPeriodId) {
      query.academicPeriodId = new mongoose.Types.ObjectId(academicPeriodId);
    }

    if (status) {
      query.status = status;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo);
      }
    }

    const skip = (page - 1) * limit;

    // Fetch invoices with populated fields
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("academicPeriodId", "yearLabel term isCurrent")
        .lean(),
      Invoice.countDocuments(query),
    ]);

    // Calculate summary — scope to same filters as returned invoices
    const summaryQuery: any = {
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
    };
    if (academicPeriodId) {
      summaryQuery.academicPeriodId = new mongoose.Types.ObjectId(academicPeriodId);
    }
    if (status) {
      summaryQuery.status = status;
    }
    if (dateFrom || dateTo) {
      summaryQuery.createdAt = {};
      if (dateFrom) summaryQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) summaryQuery.createdAt.$lte = new Date(dateTo);
    }

    const allInvoices = await Invoice.find(summaryQuery).lean();
    const activeInvoices = allInvoices.filter((invoice) =>
      ACTIVE_INVOICE_STATUSES.has(String(invoice.status))
    );
    const summary = {
      totalBilled: activeInvoices.reduce(
        (sum, inv) => sum + (inv.totalAmountMinor || 0),
        0
      ),
      totalPaid: activeInvoices.reduce(
        (sum, inv) => sum + (inv.totalPaidMinor || 0),
        0
      ),
      totalOutstanding: activeInvoices.reduce(
        (sum, inv) => sum + (inv.totalOutstandingMinor || 0),
        0
      ),
      invoiceCount: activeInvoices.length,
      paidCount: activeInvoices.filter((inv) => inv.status === "paid").length,
      overdueCount: activeInvoices.filter((inv) => inv.status === "overdue")
        .length,
    };

    return NextResponse.json({
      invoices: invoices.map((inv: any) => ({
        ...inv,
        _id: String(inv._id),
        studentId: String(inv.studentId),
        schoolId: String(inv.schoolId),
        academicPeriodId: inv.academicPeriodId
          ? {
              _id: String(inv.academicPeriodId._id),
              yearLabel: inv.academicPeriodId.yearLabel,
              term: inv.academicPeriodId.term,
              isCurrent: inv.academicPeriodId.isCurrent,
            }
          : null,
      })),
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching student invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
