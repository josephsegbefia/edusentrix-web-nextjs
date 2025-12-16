/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/fees/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { Student } from "@/models/Student";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import {
  generateInvoiceNumber,
  calculateInvoiceTotals,
} from "@/lib/fees/invoice-utils";
import { toMinorUnits } from "@/lib/fees/money";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const academicPeriodId = searchParams.get("academicPeriodId");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

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
  const { schoolId, userId } = await requireSchoolAdmin();
  await connectToDatabase();

  // ✅ start session from the SAME connection as the Invoice model
  const session = await Invoice.db.startSession();

  try {
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
            dueDate: dueDate ? new Date(dueDate) : period.endDate,
            notes: notes || null,
            terms: terms || null,
          },
        ],
        { session }
      );

      invoiceDoc = createdInvoice;

      const preparedLineItems = lineItems.map((item: any, idx: number) => {
        const amountMinor = toMinorUnits(item.amount);
        return {
          invoiceId: createdInvoice._id,
          feeStructureId: item.feeStructureId || null,
          name: item.name,
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
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      {
        status: error.message?.includes("already exists")
          ? 400
          : error.message?.includes("not found")
          ? 404
          : 500,
      }
    );
  } finally {
    await session.endSession().catch(() => {});
  }
}
