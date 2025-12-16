// src/app/api/admin/fees/credit/[studentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { Student } from "@/models/Student";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { formatMoney } from "@/lib/fees/money";
import mongoose from "mongoose";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    const { studentId } = await params;

    // Verify student exists and belongs to school
    const student = await Student.findOne({
      _id: studentId,
      schoolId,
    }).lean();

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Get or create credit balance
    let creditBalance = await StudentCreditBalance.findOne({
      schoolId,
      studentId,
    }).lean();

    if (!creditBalance) {
      // Create zero balance
      creditBalance = await StudentCreditBalance.create({
        schoolId,
        studentId,
        balanceMinor: 0,
        entries: [],
      });
    }

    // Get invoices with outstanding balances
    const invoices = await Invoice.find({
      schoolId,
      studentId,
      status: { $in: ["issued", "partially_paid", "overdue"] },
      totalOutstandingMinor: { $gt: 0 },
    })
      .sort({ dueDate: 1 })
      .populate("academicPeriodId", "yearLabel term")
      .lean();

    return NextResponse.json({
      creditBalance,
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNo: student.admissionNo,
      },
      invoices,
    });
  } catch (error) {
    console.error("Error fetching credit balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit balance" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { studentId } = await params;
    const body = await req.json();
    const { invoiceId, invoiceLineItemId, amount } = body;

    if (!invoiceId || !amount || amount <= 0) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Invoice ID and amount are required" },
        { status: 400 }
      );
    }

    // Get credit balance
    let creditBalance = await StudentCreditBalance.findOne({
      schoolId,
      studentId,
    }).session(session);

    if (!creditBalance) {
      creditBalance = await StudentCreditBalance.create(
        [
          {
            schoolId,
            studentId,
            balanceMinor: 0,
            entries: [],
          },
        ],
        { session }
      )[0];
    }

    if (creditBalance.balanceMinor < amount * 100) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Insufficient credit balance" },
        { status: 400 }
      );
    }

    // Get invoice and line item
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      schoolId,
      studentId,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const lineItem = invoiceLineItemId
      ? await InvoiceLineItem.findOne({
          _id: invoiceLineItemId,
          invoiceId,
        }).session(session)
      : null;

    if (invoiceLineItemId && !lineItem) {
      await session.abortTransaction();
      return NextResponse.json({ error: "Line item not found" }, { status: 404 });
    }

    const amountMinor = Math.round(amount * 100);

    // Apply credit
    creditBalance.balanceMinor -= amountMinor;
    creditBalance.entries.push({
      type: "application",
      amountMinor,
      appliedToInvoiceId: invoice._id,
      appliedToLineItemId: lineItem?._id || null,
      reason: `Credit applied to ${lineItem ? lineItem.name : `invoice ${invoice.invoiceNumber}`}`,
      createdAt: new Date(),
    });
    await creditBalance.save({ session });

    // Update invoice/line item (simplified - in production, you'd want to create a payment allocation)
    if (lineItem) {
      lineItem.amountPaidMinor += amountMinor;
      lineItem.amountOutstandingMinor = lineItem.amountMinor - lineItem.amountPaidMinor;
      lineItem.isFullyPaid = lineItem.amountOutstandingMinor <= 0;
      await lineItem.save({ session });
    }

    invoice.totalPaidMinor += amountMinor;
    invoice.totalOutstandingMinor = invoice.totalAmountMinor - invoice.totalPaidMinor;
    await invoice.save({ session });

    await session.commitTransaction();

    const updatedCredit = await StudentCreditBalance.findById(creditBalance._id).lean();

    return NextResponse.json({
      success: true,
      creditBalance: updatedCredit,
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error("Error applying credit:", error);
    return NextResponse.json(
      { error: error.message || "Failed to apply credit" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
