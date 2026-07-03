// src/app/api/admin/fees/credit/[studentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { StudentCreditBalance } from "@/models/StudentCreditBalance";
import { Student } from "@/models/Student";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import mongoose from "mongoose";
import { InvoiceEvent } from "@/models/InvoiceEvent";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { schoolId } = await requireFinanceStaff();
  await connectToDatabase();

  try {
    const { studentId } = await params;

    // Verify student exists and belongs to school
    const studentDoc = await Student.findOne({
      _id: studentId,
      schoolId,
    }).lean();

    // TypeScript incorrectly infers findOne().lean() could return an array
    // findOne() always returns a single document or null, never an array
    const student = (
      Array.isArray(studentDoc) ? studentDoc[0] || null : studentDoc
    ) as {
      _id: mongoose.Types.ObjectId;
      firstName: string;
      lastName: string;
      admissionNo?: string | null;
    } | null;

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Get or create credit balance
    const creditBalanceRaw = await StudentCreditBalance.findOne({
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
    }).lean();

    // Normalize creditBalance (findOne().lean() can be inferred as array by TypeScript)
    let creditBalance = (
      Array.isArray(creditBalanceRaw)
        ? creditBalanceRaw[0] || null
        : creditBalanceRaw
    ) as any;

    if (!creditBalance) {
      // Create zero balance
      const created = await StudentCreditBalance.create({
        schoolId,
        studentId,
        balanceMinor: 0,
        entries: [],
      });
      creditBalance = created.toObject() as any;
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

    // Format credit balance response
    const formattedCreditBalance = creditBalance
      ? {
          _id: String(creditBalance._id),
          schoolId: String(creditBalance.schoolId),
          studentId: String(creditBalance.studentId),
          balanceMinor: creditBalance.balanceMinor || 0,
          entries: (creditBalance.entries || []).map((e: any) => ({
            type: e.type,
            amountMinor: e.amountMinor,
            sourcePaymentId: e.sourcePaymentId
              ? String(e.sourcePaymentId)
              : null,
            appliedToInvoiceId: e.appliedToInvoiceId
              ? String(e.appliedToInvoiceId)
              : null,
            appliedToLineItemId: e.appliedToLineItemId
              ? String(e.appliedToLineItemId)
              : null,
            reason: e.reason || "",
            createdAt: e.createdAt
              ? new Date(e.createdAt).toISOString()
              : new Date().toISOString(),
          })),
          createdAt: creditBalance.createdAt
            ? new Date(creditBalance.createdAt).toISOString()
            : undefined,
        }
      : null;

    return NextResponse.json({
      creditBalance: formattedCreditBalance,
      student: {
        _id: String(student._id),
        firstName: student.firstName,
        lastName: student.lastName,
        admissionNo: student.admissionNo,
      },
      invoices: invoices.map((inv: any) => ({
        ...inv,
        _id: String(inv._id),
        schoolId: String(inv.schoolId),
        studentId: String(inv.studentId),
        academicPeriodId: inv.academicPeriodId
          ? String(inv.academicPeriodId._id || inv.academicPeriodId)
          : null,
      })),
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
  const { schoolId, userId } = await requireFinanceStaff();
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
        { error: "Bill ID and amount are required" },
        { status: 400 }
      );
    }

    // Get credit balance
    let creditBalance = await StudentCreditBalance.findOne({
      schoolId,
      studentId,
    }).session(session);

    if (!creditBalance) {
      const created = await StudentCreditBalance.create(
        [
          {
            schoolId,
            studentId,
            balanceMinor: 0,
            entries: [],
          },
        ],
        { session }
      );
      creditBalance = created[0];
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
      return NextResponse.json(
        { error: "Line item not found" },
        { status: 404 }
      );
    }

    const amountMinor = Math.round(amount * 100);

    // if lineitem is provided, validate outstanding balance
    if (lineItem && amountMinor > lineItem.amountOutstandingMinor) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Amount exceeds line item outstanding balance" },
        { status: 400 }
      );
    }

    if (lineItem && amountMinor > invoice.totalOutstandingMinor) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Amount exceeds invoice outstanding balance" },
        { status: 400 }
      );
    }

    // when updating invoice totals
    invoice.totalCreditAppliedMinor += amountMinor;

    await InvoiceEvent.create([
      {
        invoiceId: invoice._id,
        schoolId,
        studentId: invoice.studentId,
        eventType: "credit_applied",
        description: "Credit applied: ${amountMinor / 100} GHS",
        performedBy: userId || null,
      },
    ]);

    // Apply credit
    creditBalance.balanceMinor -= amountMinor;
    creditBalance.entries.push({
      type: "application",
      amountMinor,
      appliedToInvoiceId: invoice._id,
      appliedToLineItemId: lineItem?._id || null,
      reason: `Credit applied to ${
        lineItem ? lineItem.name : `invoice ${invoice.invoiceNumber}`
      }`,
      createdAt: new Date(),
    });
    await creditBalance.save({ session });

    // Update invoice/line item (simplified - in production, you'd want to create a payment allocation)
    if (lineItem) {
      lineItem.amountPaidMinor += amountMinor;
      lineItem.amountOutstandingMinor =
        lineItem.amountMinor - lineItem.amountPaidMinor;
      lineItem.isFullyPaid = lineItem.amountOutstandingMinor <= 0;
      await lineItem.save({ session });
    }

    invoice.totalPaidMinor += amountMinor;
    invoice.totalOutstandingMinor =
      invoice.totalAmountMinor - invoice.totalPaidMinor;
    await invoice.save({ session });

    await session.commitTransaction();

    const updatedCredit = await StudentCreditBalance.findById(
      creditBalance._id
    ).lean();

    return NextResponse.json({
      success: true,
      creditBalance: updatedCredit,
    });
  } catch (error: unknown) {
    await session.abortTransaction();
    console.error("Error applying credit:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to apply credit";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    await session.endSession();
  }
}
