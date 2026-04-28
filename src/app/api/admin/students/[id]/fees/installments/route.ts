/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/students/[id]/fees/installments/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireFinanceStaffOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { Student } from "@/models/Student";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireFinanceStaffOrDelegatedModuleView("fees");
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

    // Verify student exists
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
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const upcomingOnly = searchParams.get("upcomingOnly") === "true";

    // Get all invoices for student
    const invoices = await Invoice.find({
      schoolId,
      studentId: new mongoose.Types.ObjectId(studentId),
    })
      .populate("academicPeriodId", "yearLabel term")
      .lean();

    const invoiceIds = invoices.map((inv: any) => inv._id);

    // Get all line items for these invoices
    const lineItems = await InvoiceLineItem.find({
      invoiceId: { $in: invoiceIds },
    }).lean();

    const lineItemIds = lineItems.map((li: any) => li._id);

    // Build query for installments
    const query: any = {
      invoiceLineItemId: { $in: lineItemIds },
    };

    if (status) {
      query.status = status;
    }

    if (upcomingOnly) {
      query.dueDate = { $gte: new Date() };
    }

    if (dateFrom || dateTo) {
      query.dueDate = query.dueDate || {};
      if (dateFrom) {
        query.dueDate.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        query.dueDate.$lte = new Date(dateTo);
      }
    }

    // Fetch installments with populated data
    const installments = await InstallmentSchedule.find(query)
      .populate({
        path: "invoiceLineItemId",
        populate: {
          path: "invoiceId",
          select: "invoiceNumber academicPeriodId",
          populate: {
            path: "academicPeriodId",
            select: "yearLabel term",
          },
        },
      })
      .sort({ dueDate: 1 })
      .lean();

    // Get payment allocations for installments
    const installmentIds = installments.map((inst: any) => inst._id);
    const allocations = await PaymentAllocation.find({
      installmentScheduleId: { $in: installmentIds },
    })
      .populate("paymentId", "paymentDate amountMinor paymentMethod")
      .lean();

    const allocationsByInstallmentId = new Map<string, any[]>();
    for (const alloc of allocations) {
      const instId = String(alloc.installmentScheduleId);
      if (!allocationsByInstallmentId.has(instId)) {
        allocationsByInstallmentId.set(instId, []);
      }
      allocationsByInstallmentId.get(instId)!.push(alloc);
    }

    // Format installments with payment history
    const formattedInstallments = installments.map((inst: any) => {
      const lineItem = inst.invoiceLineItemId as any;
      const invoice = lineItem?.invoiceId as any;
      const period = invoice?.academicPeriodId as any;

      return {
        _id: String(inst._id),
        invoiceId: invoice ? String(invoice._id) : null,
        invoiceNumber: invoice?.invoiceNumber || null,
        lineItemName: lineItem?.name || null,
        installmentNumber: inst.installmentNumber,
        dueDate: inst.dueDate,
        amountMinor: inst.amountMinor,
        amountPaidMinor: inst.amountPaidMinor,
        amountOutstandingMinor: inst.amountOutstandingMinor,
        status: inst.status,
        periodLabel: period
          ? `${period.yearLabel} • ${period.term}`
          : null,
        payments:
          allocationsByInstallmentId.get(String(inst._id))?.map((alloc: any) => ({
            paymentId: String(alloc.paymentId?._id),
            paymentDate: alloc.paymentId?.paymentDate,
            amountMinor: alloc.amountMinor,
            paymentMethod: alloc.paymentId?.paymentMethod,
          })) || [],
      };
    });

    // Calculate summary
    const allInstallments = await InstallmentSchedule.find({
      invoiceLineItemId: { $in: lineItemIds },
    }).lean();

    const summary = {
      totalInstallments: allInstallments.length,
      paidInstallments: allInstallments.filter(
        (inst) => inst.status === "paid"
      ).length,
      pendingInstallments: allInstallments.filter(
        (inst) => inst.status === "pending"
      ).length,
      overdueInstallments: allInstallments.filter(
        (inst) => inst.status === "overdue"
      ).length,
      totalDue: allInstallments
        .filter((inst) => inst.status !== "paid")
        .reduce((sum, inst) => sum + (inst.amountOutstandingMinor || 0), 0),
      nextDueDate:
        allInstallments.length > 0
          ? allInstallments
              .filter((inst) => inst.status !== "paid")
              .sort(
                (a, b) =>
                  new Date(a.dueDate).getTime() -
                  new Date(b.dueDate).getTime()
              )[0]?.dueDate || null
          : null,
    };

    return NextResponse.json({
      installments: formattedInstallments,
      summary,
    });
  } catch (error) {
    console.error("Error fetching student installments:", error);
    return NextResponse.json(
      { error: "Failed to fetch installments" },
      { status: 500 }
    );
  }
}
