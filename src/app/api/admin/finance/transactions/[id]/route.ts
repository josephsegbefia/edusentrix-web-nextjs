// src/app/api/admin/finance/transactions/[id]/route.ts
// Single transaction detail API

import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FinancialTransaction } from "@/models/FinancialTransaction";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/finance/transactions/:id
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    interface TransactionLean {
      _id: mongoose.Types.ObjectId;
      originalTransactionId?: mongoose.Types.ObjectId | null;
      correctedById?: mongoose.Types.ObjectId | null;
      [key: string]: unknown;
    }

    const transaction = await FinancialTransaction.findOne({
      _id: id,
      schoolId,
    })
      .populate("createdBy", "name email")
      .populate("academicPeriodId", "name term yearLabel startDate endDate")
      .populate("originalTransactionId")
      .populate("correctedById")
      .lean() as TransactionLean | null;

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // If this is a correction, get the original transaction
    let originalTransaction = null;
    if (transaction.originalTransactionId) {
      originalTransaction = await FinancialTransaction.findById(
        transaction.originalTransactionId
      )
        .select("reference grossAmountMinor currency occurredAt status")
        .lean();
    }

    // If this transaction was corrected, get the correction
    let correctionTransaction = null;
    if (transaction.correctedById) {
      correctionTransaction = await FinancialTransaction.findById(
        transaction.correctedById
      )
        .select("reference grossAmountMinor currency occurredAt status category")
        .lean();
    }

    return NextResponse.json({
      data: {
        ...transaction,
        _original: originalTransaction,
        _correction: correctionTransaction,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/finance/transactions/:id
// Only allows adding notes or attachments to non-finalized transactions
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    const { id } = await params;
    await connectToDatabase();

    const transaction = await FinancialTransaction.findOne({
      _id: id,
      schoolId,
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Only allow editing notes and attachments
    const body = await req.json();
    const { notes, attachments } = body;

    if (notes !== undefined) {
      transaction.notes = notes?.trim() || null;
    }

    if (attachments !== undefined && Array.isArray(attachments)) {
      // Add new attachments
      transaction.attachments = attachments.map((att) => ({
        url: att.url,
        type: att.type || "image",
        name: att.name || null,
        uploadedAt: new Date(),
        uploadedBy: userId,
      }));
    }

    await transaction.save();

    return NextResponse.json({ data: transaction });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}
