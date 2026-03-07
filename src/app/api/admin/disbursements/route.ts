import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  computeTransactionFee,
  resolveTransactionFeeConfigForSchool,
} from "@/lib/billing/transaction-fees";
import { PlatformPayoutDestinationInputSchema } from "@/lib/platform-billing/payout-schemas";
import { School } from "@/models/School";
import { SchoolDisbursement } from "@/models/SchoolDisbursement";
import { SchoolExpense } from "@/models/SchoolExpense";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { Vendor } from "@/models/Vendor";

const CreateDisbursementSchema = z
  .object({
    recipientType: z.enum(["teacher", "vendor"]),
    teacherId: z.string().trim().optional().nullable().default(null),
    vendorId: z.string().trim().optional().nullable().default(null),
    schoolExpenseId: z.string().trim().optional().nullable().default(null),
    amountMinor: z.number().int().positive(),
    purpose: z.string().trim().min(2).max(200),
    destination: PlatformPayoutDestinationInputSchema,
    saveTeacherPayoutProfile: z.boolean().optional().default(true),
    notes: z.string().trim().max(500).optional().nullable().default(null),
    sendNow: z.boolean().optional().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.recipientType === "teacher" && !value.teacherId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teacherId"],
        message: "Teacher id is required for teacher disbursements.",
      });
    }

    if (value.recipientType === "vendor" && !value.vendorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vendorId"],
        message: "Vendor id is required for vendor disbursements.",
      });
    }
  });

function generateDisbursementReference() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const token = randomBytes(4).toString("hex").toUpperCase();
  return `DSP-${year}-${token}`;
}

function toObjectId(value?: string | null) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const status = req.nextUrl.searchParams.get("status");
    const recipientType = req.nextUrl.searchParams.get("recipientType");
    const query: Record<string, unknown> = { schoolId };

    if (
      status &&
      ["queued", "processing", "completed", "failed", "cancelled"].includes(status)
    ) {
      query.status = status;
    }

    if (recipientType && ["teacher", "vendor"].includes(recipientType)) {
      query.recipientType = recipientType;
    }

    const rows = await SchoolDisbursement.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      data: rows.map((row) => ({
        id: String(row._id),
        recipientType: row.recipientType,
        teacherId: row.teacherId ? String(row.teacherId) : null,
        vendorId: row.vendorId ? String(row.vendorId) : null,
        schoolExpenseId: row.schoolExpenseId ? String(row.schoolExpenseId) : null,
        recipientName: row.recipientName,
        purpose: row.purpose,
        amountMinor: row.amountMinor,
        platformFeeMinor: row.platformFeeMinor,
        processorFeeMinor: row.processorFeeMinor,
        totalDebitMinor: row.totalDebitMinor,
        currency: row.currency,
        status: row.status,
        paymentRail: row.paymentRail,
        reference: row.reference,
        notes: row.notes || null,
        destination: row.destination,
        approval: {
          required: row.approval?.required ?? false,
          status: row.approval?.status ?? "not_required",
          requestedAt: row.approval?.requestedAt?.toISOString?.() || null,
          approvedAt: row.approval?.approvedAt?.toISOString?.() || null,
          note: row.approval?.note || null,
        },
        gateway: row.gateway || null,
        processedAt: row.processedAt?.toISOString?.() || null,
        createdAt: row.createdAt?.toISOString?.() || null,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching disbursements:", error);
    return NextResponse.json(
      { error: "Failed to fetch disbursements" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const body = CreateDisbursementSchema.parse(await req.json());

    const teacherId = toObjectId(body.teacherId);
    const vendorId = toObjectId(body.vendorId);
    const schoolExpenseId = toObjectId(body.schoolExpenseId);

    const [schoolRaw, teacherRaw, vendorRaw, expenseRaw] = await Promise.all([
      School.findById(schoolId).select("billing.transactionFees").lean(),
      teacherId
        ? Teacher.findOne({ _id: teacherId, schoolId }).select("_id userId").lean()
        : null,
      vendorId
        ? Vendor.findOne({ _id: vendorId, schoolId }).select("_id name").lean()
        : null,
      schoolExpenseId
        ? SchoolExpense.findOne({ _id: schoolExpenseId, schoolId })
            .select("_id vendorId amountMinor status title")
            .lean()
        : null,
    ]);

    const school = schoolRaw as
      | {
          billing?: {
            transactionFees?: Record<string, unknown> | null;
          };
        }
      | null;
    const teacher = teacherRaw as
      | {
          _id: mongoose.Types.ObjectId;
          userId?: mongoose.Types.ObjectId | null;
        }
      | null;
    const vendor = vendorRaw as
      | {
          _id: mongoose.Types.ObjectId;
          name?: string | null;
        }
      | null;
    const expense = expenseRaw as
      | {
          _id: mongoose.Types.ObjectId;
          vendorId?: mongoose.Types.ObjectId | null;
          amountMinor?: number;
          status?: string;
          title?: string;
        }
      | null;

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    if (body.recipientType === "teacher") {
      if (!teacher) {
        return NextResponse.json(
          { error: "Teacher not found for this school" },
          { status: 404 }
        );
      }
    } else if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found for this school" },
        { status: 404 }
      );
    }

    if (body.recipientType === "vendor" && schoolExpenseId) {
      if (!expense) {
        return NextResponse.json(
          { error: "Linked expense not found for this school" },
          { status: 404 }
        );
      }
      if (expense.vendorId && vendorId && String(expense.vendorId) !== String(vendorId)) {
        return NextResponse.json(
          { error: "Linked expense vendor does not match the selected vendor" },
          { status: 400 }
        );
      }
    }

    let recipientName = vendor?.name || "Teacher";
    if (body.recipientType === "teacher" && teacher?.userId) {
      const teacherUser = await User.findById(teacher.userId)
        .select("name firstName lastName")
        .lean<{ name?: string; firstName?: string; lastName?: string } | null>();
      recipientName =
        teacherUser?.name ||
        [teacherUser?.firstName, teacherUser?.lastName].filter(Boolean).join(" ") ||
        "Teacher";
    }

    const feeConfig = resolveTransactionFeeConfigForSchool(
      school.billing?.transactionFees || null
    );
    const feeBreakdown = computeTransactionFee(body.amountMinor, feeConfig);
    const totalDebitMinor = body.amountMinor + feeBreakdown.feeMinor;
    const reference = generateDisbursementReference();
    const requiresApproval = body.sendNow;

    if (
      body.recipientType === "teacher" &&
      teacherId &&
      body.saveTeacherPayoutProfile
    ) {
      await Teacher.updateOne(
        { _id: teacherId, schoolId },
        {
          $set: {
            payoutProfile: {
              destination: body.destination,
              updatedAt: new Date(),
              updatedBy: userId,
            },
          },
        }
      );
    }

    const baseRecord = await SchoolDisbursement.create({
      schoolId,
      recipientType: body.recipientType,
      teacherId,
      vendorId,
      schoolExpenseId,
      recipientName,
      purpose: body.purpose,
      destination: body.destination,
      amountMinor: body.amountMinor,
      platformFeeMinor: feeBreakdown.feeMinor,
      processorFeeMinor: 0,
      totalDebitMinor,
      currency: "GHS",
      status: "queued",
      paymentRail: body.sendNow ? "paystack" : "manual",
      reference,
      notes: body.notes,
      createdBy: userId,
      approval: requiresApproval
        ? {
            required: true,
            status: "pending",
            requestedAt: new Date(),
            requestedBy: userId,
            approvedAt: null,
            approvedBy: null,
            rejectedAt: null,
            rejectedBy: null,
            note: body.notes || null,
          }
        : {
            required: false,
            status: "not_required",
            requestedAt: null,
            requestedBy: null,
            approvedAt: null,
            approvedBy: null,
            rejectedAt: null,
            rejectedBy: null,
            note: null,
          },
      processedAt: null,
      gateway: null,
    });

    const saved = await SchoolDisbursement.findById(baseRecord._id).lean();
    return NextResponse.json({
      data: {
        id: String(saved?._id || baseRecord._id),
        recipientType: saved?.recipientType || baseRecord.recipientType,
        recipientName: saved?.recipientName || baseRecord.recipientName,
        amountMinor: saved?.amountMinor || baseRecord.amountMinor,
        platformFeeMinor: saved?.platformFeeMinor || baseRecord.platformFeeMinor,
        processorFeeMinor: saved?.processorFeeMinor || baseRecord.processorFeeMinor,
        totalDebitMinor: saved?.totalDebitMinor || baseRecord.totalDebitMinor,
        status: saved?.status || baseRecord.status,
        paymentRail: saved?.paymentRail || baseRecord.paymentRail,
        reference: saved?.reference || baseRecord.reference,
        approval: saved?.approval || baseRecord.approval,
        gateway: saved?.gateway || null,
        processedAt: saved?.processedAt?.toISOString?.() || null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid disbursement payload" },
        { status: 400 }
      );
    }
    console.error("Error creating disbursement:", error);
    return NextResponse.json(
      { error: "Failed to create disbursement" },
      { status: 500 }
    );
  }
}
