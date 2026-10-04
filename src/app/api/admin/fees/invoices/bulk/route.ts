// src/app/api/admin/fees/invoices/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { InvoiceEvent } from "@/models/InvoiceEvent";
import { Student } from "@/models/Student";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { calculateInvoiceTotals } from "@/lib/fees/invoice-utils";
import { allocateInvoiceNumbers } from "@/lib/fees/invoice-numbering";
import { toMinorUnits } from "@/lib/fees/money";
import mongoose from "mongoose";

type BulkCreatedInvoice = {
  invoiceId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
};

type BulkOutcome =
  | { ok: false; status: number; error: string }
  | { ok: true; createdInvoices: BulkCreatedInvoice[]; skipped: number };

export async function POST(req: NextRequest) {
  const { schoolId, userId } = await requireFinanceStaff();
  await connectToDatabase();

  const session = await mongoose.startSession();

  try {
    const body = await req.json();
    const {
      academicPeriodId,
      studentIds,
      lineItems,
      dueDate,
      notes,
      terms,
    } = body;

    // Validate required fields
    if (!academicPeriodId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0 || !lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "Academic period, at least one student, and at least one line item are required" },
        { status: 400 }
      );
    }

    // One contiguous range reserved outside the transaction and reused on
    // withTransaction retries; numbers from an aborted attempt are never reused.
    let reservedNumbers: string[] = [];
    let outcome: BulkOutcome | null = null;

    await session.withTransaction(async () => {
      outcome = null;

      // Validate period exists
      const period = await AcademicPeriod.findOne({ _id: academicPeriodId, schoolId }).session(session);
      if (!period) {
        outcome = { ok: false, status: 404, error: "Academic period not found" };
        return;
      }

      // Validate students exist and belong to school
      const students = await Student.find({
        _id: { $in: studentIds },
        schoolId,
      }).session(session);

      if (students.length !== studentIds.length) {
        outcome = {
          ok: false,
          status: 400,
          error: "Some students not found or don't belong to this school",
        };
        return;
      }

      // Check for existing invoices
      const existingInvoices = await Invoice.find({
        schoolId,
        studentId: { $in: studentIds },
        academicPeriodId,
      }).session(session);

      const existingStudentIds = new Set(
        existingInvoices.map((inv) => inv.studentId.toString())
      );

      // Filter out students who already have invoices
      const studentsToProcess = students.filter(
        (s) => !existingStudentIds.has(s._id.toString())
      );

      if (studentsToProcess.length === 0) {
        outcome = {
          ok: false,
          status: 400,
          error: "All selected students already have invoices for this academic period",
        };
        return;
      }

      if (reservedNumbers.length < studentsToProcess.length) {
        const allocation = await allocateInvoiceNumbers({
          schoolId,
          count: studentsToProcess.length,
        });
        reservedNumbers = allocation.numbers;
      }

      const createdInvoices: BulkCreatedInvoice[] = [];

      // Create invoices for each student
      for (let i = 0; i < studentsToProcess.length; i++) {
        const student = studentsToProcess[i];
        const invoiceNumber = reservedNumbers[i]!;

        // Create invoice
        const invoice = await Invoice.create(
          [
            {
              schoolId,
              studentId: student._id,
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

        // Create line items
        const createdLineItems = [];
        for (let j = 0; j < lineItems.length; j++) {
          const item = lineItems[j];
          const amountMinor = toMinorUnits(item.amount);

          const lineItem = await InvoiceLineItem.create(
            [
              {
                invoiceId: invoice[0]._id,
                feeStructureId: item.feeStructureId || null,
                name: item.name,
                description: item.description || null,
                amountMinor,
                displayOrder: j + 1,
                allowsInstallments: item.allowsInstallments || false,
                numberOfInstallments: item.numberOfInstallments || null,
                amountPaidMinor: 0,
                amountOutstandingMinor: amountMinor,
                isFullyPaid: false,
                status: "pending",
                isAdjustment: false,
              },
            ],
            { session }
          );

          createdLineItems.push(lineItem[0]);
        }

        // Calculate totals
        const totals = calculateInvoiceTotals(
          createdLineItems.map((li) => ({
            amountMinor: li.amountMinor,
            amountPaidMinor: li.amountPaidMinor,
          }))
        );

        // Update invoice totals
        invoice[0].totalAmountMinor = totals.totalAmountMinor;
        invoice[0].totalOutstandingMinor = totals.totalOutstandingMinor;
        await invoice[0].save({ session });

        // Create invoice event
        await InvoiceEvent.create(
          [
            {
              invoiceId: invoice[0]._id,
              schoolId,
              studentId: student._id,
              eventType: "created",
              description: `Invoice ${invoiceNumber} created via bulk operation`,
              performedBy: userId || null,
            },
          ],
          { session }
        );

        createdInvoices.push({
          invoiceId: invoice[0]._id,
          invoiceNumber,
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
        });
      }

      outcome = {
        ok: true,
        createdInvoices,
        skipped: existingStudentIds.size,
      };
    });

    const result = outcome as BulkOutcome | null;
    if (!result) {
      throw new Error("Failed to create bulk invoices");
    }
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      {
        success: true,
        created: result.createdInvoices.length,
        skipped: result.skipped,
        invoices: result.createdInvoices,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating bulk invoices:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create bulk invoices" },
      { status: 500 }
    );
  } finally {
    await session.endSession();
  }
}
