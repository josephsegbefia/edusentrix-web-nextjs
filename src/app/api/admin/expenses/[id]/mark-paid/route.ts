// src/app/api/admin/expenses/[id]/mark-paid/route.ts
// Mark approved expense as paid and write to ledger

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolExpense, ExpensePaymentMethod } from "@/models/SchoolExpense";
import { FinancialTransaction } from "@/models/FinancialTransaction";
import { Vendor } from "@/models/Vendor";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/admin/expenses/:id/mark-paid
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    const { id } = await params;
    await connectToDatabase();

    const expense = await SchoolExpense.findOne({
      _id: id,
      schoolId,
    }).populate("vendorId", "name phone email");

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Check if expense can be marked as paid
    if (expense.status !== "approved") {
      return NextResponse.json(
        { error: "Only approved expenses can be marked as paid" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { paymentMethod, paymentReference, paidAt } = body;

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method is required" },
        { status: 400 }
      );
    }

    const validMethods: ExpensePaymentMethod[] = [
      "cash",
      "mobile_money",
      "bank_transfer",
      "cheque",
      "card",
      "other",
    ];
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
    }

    // Update expense
    expense.status = "paid";
    expense.paymentMethod = paymentMethod;
    expense.paymentReference = paymentReference?.trim() || null;
    expense.paidAt = paidAt ? new Date(paidAt) : new Date();
    expense.paidBy = userId;
    expense.lockedAt = new Date();
    expense.lockReason = "paid";

    // Create ledger entry (FinancialTransaction)
    const vendor = expense.vendorId as unknown as {
      _id: string;
      name: string;
      phone?: string;
      email?: string;
    } | null;

    const transaction = await FinancialTransaction.create({
      schoolId,
      direction: "outflow",
      status: "success",
      grossAmountMinor: expense.amountMinor,
      feeAmountMinor: 0,
      netAmountMinor: expense.amountMinor,
      currency: expense.currency,
      occurredAt: expense.paidAt,
      category: "expenses",
      sourceModule: "expenses",
      sourceId: expense._id,
      method: paymentMethod,
      channel: "in_app",
      reference: expense.expenseNumber,
      description: expense.title,
      party: vendor
        ? {
            type: "vendor",
            id: vendor._id,
            name: vendor.name,
            contact: {
              phone: vendor.phone || null,
              email: vendor.email || null,
            },
          }
        : null,
      academicPeriodId: expense.academicPeriodId || null,
      attachments: expense.receipts.map((r: { url: string; type: "image" | "pdf"; name?: string | null; uploadedAt: Date; uploadedBy: string }) => ({
        url: r.url,
        type: r.type,
        name: r.name,
        uploadedAt: r.uploadedAt,
        uploadedBy: r.uploadedBy,
      })),
      meta: {
        expenseTitle: expense.title,
        costCenter: expense.costCenter,
        paymentReference: paymentReference || null,
      },
      reconciliation: {
        status: "unmatched",
        provider: null,
      },
      createdBy: userId,
      finalizedAt: new Date(),
      finalizedReason: "expense_paid",
    });

    // Link transaction to expense
    expense.financialTransactionId = transaction._id;
    await expense.save();

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "expense.paid",
      description: `Marked expense ${expense.expenseNumber} as paid via ${paymentMethod}`,
      metadata: {
        expenseId: expense._id,
        expenseNumber: expense.expenseNumber,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        paymentMethod,
        transactionId: transaction._id,
      },
    });

    // Populate for response
    await expense.populate([
      { path: "categoryId", select: "name code" },
      { path: "vendorId", select: "name" },
      { path: "createdBy", select: "name email" },
      { path: "approvedBy", select: "name email" },
      { path: "paidBy", select: "name email" },
    ]);

    return NextResponse.json({
      message: "Expense marked as paid",
      data: expense,
      transaction: {
        _id: transaction._id,
        reference: transaction.reference,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error marking expense as paid:", error);
    return NextResponse.json(
      { error: "Failed to mark expense as paid" },
      { status: 500 }
    );
  }
}
