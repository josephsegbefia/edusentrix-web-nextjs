/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/fees/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { requireFinanceStaffOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { InstallmentSchedule } from "@/models/InstallmentSchedule";
import { Student } from "@/models/Student";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import {
  generateInvoiceNumber,
  calculateInvoiceTotals,
} from "@/lib/fees/invoice-utils";
import { calculateInstallmentAmounts, toMinorUnits } from "@/lib/fees/money";
import mongoose from "mongoose";

function dayTime(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function buildInstallmentScheduleItems(
  item: any,
  invoiceDueDate: Date,
  totalAmountMinor: number
) {
  if (!item.allowsInstallments) return [];
  const installmentCount = Number(item.numberOfInstallments || 0);
  if (installmentCount < 2) return [];

  if (Array.isArray(item.installmentSchedule) && item.installmentSchedule.length > 0) {
    const schedules = item.installmentSchedule.map((scheduleItem: any, index: number) => ({
      installmentNumber: Number(scheduleItem.installmentNumber || index + 1),
      dueDate: new Date(scheduleItem.dueDate),
      amountMinor: toMinorUnits(Number(scheduleItem.amount)),
    }));
    const scheduledTotal = schedules.reduce(
      (sum: number, scheduleItem: any) => sum + Number(scheduleItem.amountMinor || 0),
      0
    );
    if (scheduledTotal !== totalAmountMinor) {
      throw new Error(
        `${item.name?.trim() || "Line item"} installment amounts must equal the line item total.`
      );
    }
    return schedules;
  }

  const amounts = calculateInstallmentAmounts(totalAmountMinor, installmentCount);
  return amounts.map((amountMinor, index) => {
    const dueDate = new Date(invoiceDueDate);
    dueDate.setDate(dueDate.getDate() + index * 30);
    return {
      installmentNumber: index + 1,
      dueDate,
      amountMinor,
    };
  });
}

export async function GET(req: NextRequest) {
  const { schoolId } = await requireFinanceStaffOrDelegatedModuleView("fees");
  await connectToDatabase();

  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const academicPeriodId = searchParams.get("academicPeriodId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    if (studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: 400 }
      );
    }
    if (academicPeriodId && !mongoose.Types.ObjectId.isValid(academicPeriodId)) {
      return NextResponse.json(
        { error: "Invalid academic period ID" },
        { status: 400 }
      );
    }

    const query: any = { schoolId };
    if (studentId) query.studentId = new mongoose.Types.ObjectId(studentId);
    if (academicPeriodId) query.academicPeriodId = new mongoose.Types.ObjectId(academicPeriodId);
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("studentId", "firstName lastName admissionNo")
        .populate("academicPeriodId", "yearLabel term")
        .lean(),
      Invoice.countDocuments(query),
    ]);

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let session: mongoose.ClientSession | null = null;

  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();

    const { requireSchoolFeature } = await import("@/lib/subscriptions/guards");
    const { FEATURE_KEYS } = await import("@/lib/subscriptions/feature-keys");
    const feeGate = await requireSchoolFeature(schoolId, FEATURE_KEYS.FINANCE_FEES);
    if (!feeGate.allowed) {
      return NextResponse.json(
        { success: false, error: feeGate.reason },
        { status: feeGate.statusCode }
      );
    }

    // Start session from the same connection as the Invoice model.
    session = await Invoice.db.startSession();
    const body = await req.json();
    const { studentId, academicPeriodId, lineItems, dueDate, notes, terms } =
      body;

    if (
      !studentId ||
      !academicPeriodId ||
      !Array.isArray(lineItems) ||
      lineItems.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Student, academic period, and at least one line item are required",
        },
        { status: 400 }
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(studentId) ||
      !mongoose.Types.ObjectId.isValid(academicPeriodId)
    ) {
      return NextResponse.json(
        { error: "Invalid student or academic period" },
        { status: 400 }
      );
    }

    for (const [index, item] of lineItems.entries()) {
      if (!item?.name || typeof item.name !== "string" || !item.name.trim()) {
        return NextResponse.json(
          { error: `Line item ${index + 1} needs a name` },
          { status: 400 }
        );
      }

      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: `Line item ${index + 1} needs a valid amount` },
          { status: 400 }
        );
      }

      if (
        item.feeStructureId &&
        !mongoose.Types.ObjectId.isValid(item.feeStructureId)
      ) {
        return NextResponse.json(
          { error: `Line item ${index + 1} has an invalid fee structure` },
          { status: 400 }
        );
      }
    }

    let invoiceDoc: any = null;

    await session.withTransaction(async () => {
      // ensure uniqueness
      const existing = await Invoice.findOne({
        schoolId,
        studentId: new mongoose.Types.ObjectId(studentId),
        academicPeriodId: new mongoose.Types.ObjectId(academicPeriodId),
      }).session(session);

      if (existing) {
        throw new Error(
          "Invoice already exists for this student and academic period"
        );
      }

      const [student, period] = await Promise.all([
        Student.findOne({ _id: studentId, schoolId }).session(session),
        AcademicPeriod.findOne({ _id: academicPeriodId, schoolId }).session(
          session
        ),
      ]);

      if (!student) throw new Error("Student not found");
      if (!period) throw new Error("Academic period not found");

      const periodEndTime = dayTime(period.endDate);
      const invoiceDueDate = dueDate ? new Date(dueDate) : period.endDate;
      for (const [index, item] of lineItems.entries()) {
        const amountMinor = toMinorUnits(Number(item.amount));
        const scheduleItems = buildInstallmentScheduleItems(
          item,
          invoiceDueDate,
          amountMinor
        );
        for (const scheduleItem of scheduleItems) {
          if (dayTime(scheduleItem.dueDate) > periodEndTime) {
            throw new Error(
              `Installment ${scheduleItem.installmentNumber} for line item ${index + 1} would fall after the academic period end date. Adjust the bill due date or installment schedule.`
            );
          }
        }
      }

      const year = new Date().getFullYear();
      const count = await Invoice.countDocuments({ schoolId }).session(session);
      const invoiceNumber = generateInvoiceNumber(year, count + 1);

      const [createdInvoice] = await Invoice.create(
        [
          {
            schoolId,
            studentId,
            academicPeriodId,
            invoiceNumber,
            status: "draft",
            totalAmountMinor: 0,
            totalPaidMinor: 0,
            totalOutstandingMinor: 0,
            totalCreditAppliedMinor: 0,
            version: 1,
            dueDate: invoiceDueDate,
            notes: notes || null,
            terms: terms || null,
          },
        ],
        { session }
      );

      invoiceDoc = createdInvoice;

      const preparedLineItems = lineItems.map((item: any, idx: number) => {
        const amountMinor = toMinorUnits(Number(item.amount));
        return {
          invoiceId: createdInvoice._id,
          feeStructureId: item.feeStructureId || null,
          name: item.name.trim(),
          description: item.description || null,
          amountMinor,
          displayOrder: idx + 1,
          allowsInstallments: item.allowsInstallments || false,
          numberOfInstallments: item.numberOfInstallments || null,
          amountPaidMinor: 0,
          amountOutstandingMinor: amountMinor,
          isFullyPaid: false,
          status: "pending",
          isAdjustment: false,
        };
      });

      const createdLineItems = await InvoiceLineItem.insertMany(
        preparedLineItems,
        { session }
      );

      const totals = calculateInvoiceTotals(
        createdLineItems.map((li) => ({
          amountMinor: li.amountMinor,
          amountPaidMinor: li.amountPaidMinor,
        }))
      );

      for (const [index, createdLineItem] of createdLineItems.entries()) {
        const sourceItem = lineItems[index];
        const scheduleItems = buildInstallmentScheduleItems(
          sourceItem,
          invoiceDueDate,
          Number(createdLineItem.amountMinor || 0)
        );
        if (!scheduleItems.length) continue;

        await InstallmentSchedule.insertMany(
          scheduleItems.map((scheduleItem) => ({
            invoiceLineItemId: createdLineItem._id,
            installmentNumber: scheduleItem.installmentNumber,
            dueDate: scheduleItem.dueDate,
            amountMinor: scheduleItem.amountMinor,
            amountPaidMinor: 0,
            amountOutstandingMinor: scheduleItem.amountMinor,
            status: "pending",
          })),
          { session }
        );
      }

      createdInvoice.totalAmountMinor = totals.totalAmountMinor;
      createdInvoice.totalOutstandingMinor = totals.totalOutstandingMinor;
      await createdInvoice.save({ session });

      await InvoiceEvent.create(
        [
          {
            invoiceId: createdInvoice._id,
            schoolId,
            studentId,
            eventType: "created",
            description: `Invoice ${invoiceNumber} created`,
            performedBy: userId || null,
          },
        ],
        { session }
      );
    });

    const fullInvoice = await Invoice.findById(invoiceDoc._id)
      .populate("studentId", "firstName lastName admissionNo")
      .populate("academicPeriodId", "yearLabel term")
      .lean();

    return NextResponse.json({ invoice: fullInvoice }, { status: 201 });
  } catch (error: any) {
    if (error instanceof Response) {
      return error;
    }

    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      {
        status: error.message?.includes("already exists")
          ? 400
          : error.message?.includes("Installment")
          ? 400
          : error.message?.includes("not found")
          ? 404
          : 500,
      }
    );
  } finally {
    await session?.endSession().catch(() => {});
  }
}
