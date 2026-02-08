// src/app/api/admin/finance/transactions/manual/route.ts
// API for recording manual transactions (other income, adjustments)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  FinancialTransaction,
  TransactionDirection,
  TransactionCategory,
  TransactionMethod,
} from "@/models/FinancialTransaction";
import { recordActivity } from "@/lib/audit/recordActivity";

// ========================
// Validation Schema
// ========================

const ManualTransactionSchema = z.object({
  direction: z.enum(["inflow", "outflow"]),
  category: z.enum([
    "other_income",
    "refund",
    "adjustment",
    "gateway_fee",
    "bank_charge",
    "penalty",
    "discount",
  ]),
  grossAmountMinor: z.number().int().positive("Amount must be positive"),
  feeAmountMinor: z.number().int().min(0).optional().default(0),
  currency: z.string().optional().default("GHS"),
  occurredAt: z.string().optional(), // ISO date
  method: z.enum([
    "cash",
    "mobile_money",
    "bank_transfer",
    "card",
    "cheque",
    "other",
  ]),
  reference: z.string().optional(),
  description: z.string().min(1, "Description is required").max(500),
  notes: z.string().max(1000).optional(),
  partyName: z.string().optional(),
  partyType: z.enum(["student", "guardian", "vendor", "staff", "donor", "other"]).optional(),
  partyEmail: z.string().email().optional().or(z.literal("")),
  partyPhone: z.string().optional(),
  academicPeriodId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requiresApproval: z.boolean().optional().default(false),
});

// ========================
// POST Handler
// ========================

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const body = await req.json();
    const result = ManualTransactionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Calculate net amount
    const netAmountMinor =
      data.direction === "inflow"
        ? data.grossAmountMinor - data.feeAmountMinor
        : data.grossAmountMinor;

    // Determine status based on approval requirement
    const status = data.requiresApproval ? "pending" : "success";

    // Build party object
    const party = data.partyName
      ? {
          type: data.partyType || "other",
          id: null,
          name: data.partyName,
          contact: {
            email: data.partyEmail || null,
            phone: data.partyPhone || null,
          },
        }
      : null;

    // Create transaction
    const transaction = await FinancialTransaction.create({
      schoolId: schoolIdObj,
      direction: data.direction as TransactionDirection,
      status,
      grossAmountMinor: data.grossAmountMinor,
      feeAmountMinor: data.feeAmountMinor,
      netAmountMinor,
      currency: data.currency,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      category: data.category as TransactionCategory,
      sourceModule: "manual",
      sourceId: null,
      method: data.method as TransactionMethod,
      channel: "in_app",
      reference: data.reference?.trim() || null,
      description: data.description.trim(),
      notes: data.notes?.trim() || null,
      tags: data.tags || [],
      party,
      academicPeriodId: data.academicPeriodId
        ? new mongoose.Types.ObjectId(data.academicPeriodId)
        : null,
      meta: {
        isManualEntry: true,
        requiresApproval: data.requiresApproval,
      },
      approval: data.requiresApproval
        ? {
            required: true,
            status: "pending",
            requestedBy: new mongoose.Types.ObjectId(String(userId)),
            requestedAt: new Date(),
          }
        : null,
      reconciliation: {
        status: "unmatched",
        provider: null,
      },
      createdBy: new mongoose.Types.ObjectId(String(userId)),
      finalizedAt: data.requiresApproval ? null : new Date(),
      finalizedReason: data.requiresApproval ? null : "manual_entry",
    });

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "transaction.created",
      entityType: "financial_transaction",
      entityId: String(transaction._id),
      description: `Recorded manual ${data.direction}: ${(data.grossAmountMinor / 100).toFixed(2)} ${data.currency}`,
      metadata: {
        transactionId: String(transaction._id),
        direction: data.direction,
        category: data.category,
        amountMinor: data.grossAmountMinor,
        requiresApproval: data.requiresApproval,
      },
    });

    return NextResponse.json({
      success: true,
      transactionId: String(transaction._id),
      status,
      message: data.requiresApproval
        ? "Transaction recorded and pending approval"
        : "Transaction recorded successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating manual transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
