// src/app/api/demo/fees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getDemoContext } from "@/lib/demo/api-utils";
import { Invoice } from "@/models/Invoice";

export async function GET(req: NextRequest) {
  try {
    const demoContext = await getDemoContext();

    if (!demoContext.isDemo || !demoContext.demoTenantId) {
      return NextResponse.json({ error: "Demo session required" }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));

    const filter = { demoTenantId: demoContext.demoTenantId };
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate("studentId", "firstName lastName studentId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    const data = invoices.map((inv) => {
      const student = inv.studentId as { firstName?: string; lastName?: string; studentId?: string } | null;
      return {
        _id: String(inv._id),
        invoiceNumber: inv.invoiceNumber,
        studentName: student
          ? `${student.firstName || ""} ${student.lastName || ""}`.trim()
          : "Unknown",
        studentId: student?.studentId,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount || 0,
        balance: inv.totalAmount - (inv.paidAmount || 0),
        status: inv.status,
        dueDate: inv.dueDate,
        createdAt: inv.createdAt,
      };
    });

    // Summary stats
    const allInvoices = await Invoice.find(filter).select("totalAmount paidAmount status").lean();
    const summary = {
      totalInvoiced: allInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0),
      totalCollected: allInvoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0),
      totalOutstanding: allInvoices.reduce((sum, i) => sum + (i.totalAmount - (i.paidAmount || 0)), 0),
      invoiceCount: allInvoices.length,
      paidCount: allInvoices.filter((i) => i.status === "paid").length,
      pendingCount: allInvoices.filter((i) => i.status === "pending" || i.status === "partial").length,
    };

    return NextResponse.json({
      data,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Demo Fees] Error:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}
