/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import {
  ReconciliationIngestion,
  type ReconciliationSourceType,
} from "@/models/ReconciliationIngestion";
import { normalizeReconciliationReference } from "@/lib/fees/reconciliation/deterministic";

const SourceSchema = z.enum(["gateway", "bank", "manual"]);
const StatusSchema = z.enum(["unmatched", "matched", "ambiguous", "ignored"]);

const IngestionEntrySchema = z.object({
  externalTxnId: z.string().trim().min(1).max(120),
  amountMinor: z.number().int().min(0),
  transactionDate: z.string().datetime(),
  reference: z.string().trim().max(160).optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  payerName: z.string().trim().max(120).optional(),
  payerPhone: z.string().trim().max(40).optional(),
  payerEmail: z.string().trim().max(160).optional(),
  bankAccountName: z.string().trim().max(120).optional(),
  channel: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const PostSchema = z.object({
  sourceType: SourceSchema,
  entries: z.array(IngestionEntrySchema).min(1).max(500),
});

function toObjectId(
  value: string | mongoose.Types.ObjectId | null | undefined,
  label = "id"
) {
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(String(value));
}

function serializeItem(item: any) {
  return {
    id: String(item._id),
    schoolId: String(item.schoolId),
    sourceType: item.sourceType,
    externalTxnId: item.externalTxnId,
    normalizedReference: item.normalizedReference || null,
    rawReference: item.rawReference || null,
    amountMinor: Number(item.amountMinor || 0),
    currency: item.currency || "GHS",
    transactionDate: item.transactionDate,
    payerName: item.payerName || null,
    payerPhone: item.payerPhone || null,
    payerEmail: item.payerEmail || null,
    channel: item.channel || null,
    status: item.status,
    matchMethod: item.matchMethod,
    matchedPaymentId: item.matchedPaymentId ? String(item.matchedPaymentId) : null,
    candidatePaymentIds: Array.isArray(item.candidatePaymentIds)
      ? item.candidatePaymentIds.map((id: mongoose.Types.ObjectId) => String(id))
      : [],
    confidence: Number(item.confidence || 0),
    notes: item.notes || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();
    const schoolIdObj = toObjectId(schoolId, "schoolId");

    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 20))
    );
    const sourceTypeRaw = req.nextUrl.searchParams.get("sourceType");
    const statusRaw = req.nextUrl.searchParams.get("status");
    const q = String(req.nextUrl.searchParams.get("q") || "").trim();

    const sourceType = sourceTypeRaw
      ? SourceSchema.safeParse(sourceTypeRaw)
      : { success: true, data: undefined };
    if (!sourceType.success) {
      return NextResponse.json(
        { success: false, error: "Invalid sourceType filter." },
        { status: 400 }
      );
    }

    const status = statusRaw
      ? StatusSchema.safeParse(statusRaw)
      : { success: true, data: undefined };
    if (!status.success) {
      return NextResponse.json(
        { success: false, error: "Invalid status filter." },
        { status: 400 }
      );
    }

    const filter: Record<string, unknown> = { schoolId: schoolIdObj };
    if (sourceType.data) filter.sourceType = sourceType.data;
    if (status.data) filter.status = status.data;
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { externalTxnId: regex },
        { rawReference: regex },
        { normalizedReference: regex },
        { payerName: regex },
        { payerPhone: regex },
        { payerEmail: regex },
      ];
    }

    const [items, total, summaryRows] = await Promise.all([
      ReconciliationIngestion.find(filter)
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ReconciliationIngestion.countDocuments(filter),
      ReconciliationIngestion.aggregate([
        { $match: { schoolId: schoolIdObj } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    const summary = summaryRows.reduce(
      (acc, row: { _id: string; count: number }) => {
        acc[row._id] = Number(row.count || 0);
        return acc;
      },
      {
        unmatched: 0,
        matched: 0,
        ambiguous: 0,
        ignored: 0,
      } as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: {
        items: items.map(serializeItem),
        summary,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to fetch reconciliation ingestions.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireFinanceStaff();
    await connectToDatabase();
    const schoolIdObj = toObjectId(schoolId, "schoolId");
    const userIdObj =
      userId && mongoose.Types.ObjectId.isValid(String(userId))
        ? new mongoose.Types.ObjectId(String(userId))
        : null;

    const parsed = PostSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid ingestion payload." },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const entry of parsed.data.entries) {
      const normalizedReference = normalizeReconciliationReference(
        entry.reference || entry.externalTxnId
      );

      const existing = await ReconciliationIngestion.findOne({
        schoolId: schoolIdObj,
        sourceType: parsed.data.sourceType as ReconciliationSourceType,
        externalTxnId: entry.externalTxnId,
      }).lean();

      const shouldResetStatus =
        existing &&
        (existing.status === "ambiguous" || existing.status === "ignored");

      const updatePayload: Record<string, unknown> = {
        normalizedReference,
        rawReference: entry.reference || null,
        amountMinor: entry.amountMinor,
        currency: (entry.currency || "GHS").toUpperCase(),
        transactionDate: new Date(entry.transactionDate),
        payerName: entry.payerName || null,
        payerPhone: entry.payerPhone || null,
        payerEmail: entry.payerEmail || null,
        bankAccountName: entry.bankAccountName || null,
        channel: entry.channel || null,
        notes: entry.notes || null,
        metadata: entry.metadata || null,
        ingestedAt: new Date(),
      };

      if (shouldResetStatus) {
        updatePayload.status = "unmatched";
        updatePayload.matchMethod = "none";
        updatePayload.matchedPaymentId = null;
        updatePayload.candidatePaymentIds = [];
        updatePayload.confidence = 0;
      }

      const op = await ReconciliationIngestion.updateOne(
        {
          schoolId: schoolIdObj,
          sourceType: parsed.data.sourceType as ReconciliationSourceType,
          externalTxnId: entry.externalTxnId,
        },
        {
          $set: updatePayload,
          $setOnInsert: {
            schoolId: schoolIdObj,
            sourceType: parsed.data.sourceType,
            externalTxnId: entry.externalTxnId,
            status: "unmatched",
            matchMethod: "none",
            matchedPaymentId: null,
            candidatePaymentIds: [],
            confidence: 0,
            createdBy: userIdObj,
          },
        },
        { upsert: true }
      );

      if (op.upsertedCount > 0) {
        created += 1;
      } else if (op.modifiedCount > 0) {
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sourceType: parsed.data.sourceType,
        total: parsed.data.entries.length,
        created,
        updated,
        unchanged,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to ingest reconciliation data.",
      },
      { status: 500 }
    );
  }
}
