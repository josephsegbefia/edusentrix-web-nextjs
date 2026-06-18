// src/app/api/parent/payments/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { toMajorUnits } from "@/lib/fees/money";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { Payment } from "@/models/Payment";
import { Invoice } from "@/models/Invoice";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";

type GuardianLink = {
  studentId: mongoose.Types.ObjectId;
};

type StudentRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
};

type PaymentRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  amountMinor?: number;
  paymentDate?: Date;
  paymentMethod?: string;
  paystackReference?: string | null;
  externalReference?: string | null;
  receiptNumber?: string | null;
  invoiceId?: mongoose.Types.ObjectId | null;
  notes?: string;
};

type InvoiceTitleRow = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber?: string;
};

type PaymentSummaryRow = {
  amountMinor?: number;
  paymentDate?: Date;
};

type LearnPaymentRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  amountMinor?: number;
  status: string;
  paymentMethod?: string;
  paystackReference?: string | null;
  createdAt?: Date;
  initiatedAt?: Date;
  succeededAt?: Date | null;
};

type PaymentQuery = {
  studentId: { $in: mongoose.Types.ObjectId[] };
  schoolId: mongoose.Types.ObjectId;
  status: "completed";
  paymentDate?: {
    $gte: Date;
    $lte: Date;
  };
};

type LearnPaymentQuery = {
  studentId: { $in: mongoose.Types.ObjectId[] };
  schoolId: mongoose.Types.ObjectId;
  parentUserId: mongoose.Types.ObjectId;
  createdAt?: {
    $gte: Date;
    $lte: Date;
  };
};

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
      .lean<GuardianLink[]>();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: {
          payments: [],
          wards: [],
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

    let studentIds = guardians.map((g) => g.studentId);

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
      .lean<StudentRow[]>();

    const studentMap = new Map(
      students.map((s) => [
        String(s._id),
        `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      ])
    );

    // Build query filters
    const filter: PaymentQuery = {
      studentId: { $in: studentIds },
      schoolId: context.schoolId,
      status: "completed",
    };
    const learnFilter: LearnPaymentQuery = {
      studentId: { $in: studentIds },
      schoolId: context.schoolId,
      parentUserId: context.userId,
    };

    // Date filters
    if (year && month) {
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      filter.paymentDate = { $gte: startDate, $lte: endDate };
      learnFilter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);
      filter.paymentDate = { $gte: startDate, $lte: endDate };
      learnFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Get total count
    const [feeTotalCount, learnTotalCount] = await Promise.all([
      Payment.countDocuments(filter),
      LearnPaymentIntent.countDocuments(learnFilter),
    ]);
    const totalCount = feeTotalCount + learnTotalCount;

    // Fetch payments
    const fetchLimit = offset + limit;
    const [payments, learnPayments] = await Promise.all([
      Payment.find(filter)
        .select(
          "studentId amountMinor paymentDate paymentMethod paystackReference externalReference receiptNumber invoiceId notes"
        )
        .sort({ paymentDate: -1, createdAt: -1 })
        .limit(fetchLimit)
        .lean<PaymentRow[]>(),
      LearnPaymentIntent.find(learnFilter)
        .select("_id studentId amountMinor status paymentMethod paystackReference createdAt initiatedAt succeededAt")
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean<LearnPaymentRow[]>(),
    ]);

    // Get invoice titles
    const invoiceIds = payments
      .map((p) => p.invoiceId)
      .filter((invoiceId): invoiceId is mongoose.Types.ObjectId => Boolean(invoiceId));
    const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
      .select("_id invoiceNumber")
      .lean<InvoiceTitleRow[]>();
    const invoiceMap = new Map(
      invoices.map((inv) => [String(inv._id), inv.invoiceNumber || "School Fees"])
    );

    // Format payments
    const formattedPayments = [
      ...payments.map((p) => ({
        id: String(p._id),
        type: "fee" as const,
        status: "completed",
        wardId: String(p.studentId),
        wardName: studentMap.get(String(p.studentId)) || "Unknown",
        amount: toMajorUnits(Number(p.amountMinor || 0)),
        date: p.paymentDate?.toISOString() || "",
        method: p.paymentMethod || "cash",
        reference: p.paystackReference || p.externalReference || p.receiptNumber || "",
        invoiceTitle: p.invoiceId ? invoiceMap.get(String(p.invoiceId)) || "School Fees" : "School Fees",
        notes: p.notes || "",
        receiptViewUrl: `/api/parent/receipts/fee/${String(p._id)}/download?disposition=inline`,
        receiptDownloadUrl: `/api/parent/receipts/fee/${String(p._id)}/download`,
      })),
      ...learnPayments.map((p) => {
        const issued = p.status === "succeeded";
        return {
          id: String(p._id),
          type: "learn" as const,
          status: p.status,
          wardId: String(p.studentId),
          wardName: studentMap.get(String(p.studentId)) || "Unknown",
          amount: toMajorUnits(Number(p.amountMinor || 0)),
          date: (p.succeededAt || p.createdAt || p.initiatedAt)?.toISOString() || "",
          method: p.paymentMethod || "paystack",
          reference: p.paystackReference || "",
          invoiceTitle: "EduSentrix Learn",
          notes: issued ? "Learn access payment" : "Learn payment is still being confirmed",
          receiptViewUrl: issued ? `/api/parent/receipts/learn/${String(p._id)}/download?disposition=inline` : "",
          receiptDownloadUrl: issued ? `/api/parent/receipts/learn/${String(p._id)}/download` : "",
        };
      }),
    ]
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(offset, offset + limit);

    // Calculate summaries
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisYearStart = new Date(now.getFullYear(), 0, 1);

    const [allPayments, allLearnPayments] = await Promise.all([
      Payment.find({
        studentId: { $in: studentIds },
        schoolId: context.schoolId,
        status: "completed",
      })
        .select("amountMinor paymentDate")
        .lean<PaymentSummaryRow[]>(),
      LearnPaymentIntent.find({
        studentId: { $in: studentIds },
        schoolId: context.schoolId,
        parentUserId: context.userId,
        status: "succeeded",
      })
        .select("amountMinor succeededAt createdAt")
        .lean<Array<{ amountMinor?: number; succeededAt?: Date | null; createdAt?: Date }>>(),
    ]);

    let totalAmount = 0;
    let thisMonthAmount = 0;
    let thisYearAmount = 0;

    allPayments.forEach((p) => {
      const amount = toMajorUnits(Number(p.amountMinor || 0));
      totalAmount += amount;
      if (!p.paymentDate) return;
      const date = new Date(p.paymentDate);
      if (date >= thisYearStart) thisYearAmount += amount;
      if (date >= thisMonthStart) thisMonthAmount += amount;
    });
    allLearnPayments.forEach((p) => {
      const amount = toMajorUnits(Number(p.amountMinor || 0));
      totalAmount += amount;
      const date = new Date(p.succeededAt || p.createdAt || 0);
      if (date >= thisYearStart) thisYearAmount += amount;
      if (date >= thisMonthStart) thisMonthAmount += amount;
    });

    return NextResponse.json({
      success: true,
      data: {
        payments: formattedPayments,
        wards: students.map((s) => ({
          id: String(s._id),
          name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        })),
        summary: {
          totalPayments: allPayments.length + allLearnPayments.length,
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
