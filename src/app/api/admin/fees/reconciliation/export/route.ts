// src/app/api/admin/fees/reconciliation/export/route.ts
// Export reconciliation report (ingestions + payments + match status) for audit

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { ReconciliationIngestion } from "@/models/ReconciliationIngestion";
import { Payment } from "@/models/Payment";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const searchParams = req.nextUrl.searchParams;
    const sourceType = searchParams.get("sourceType");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const formatParam = searchParams.get("format") || "csv";

    const matchFilter: Record<string, unknown> = { schoolId: schoolIdObj };
    if (sourceType) matchFilter.sourceType = sourceType;
    if (status) matchFilter.status = status;

    if (dateFrom || dateTo) {
      matchFilter.transactionDate = {};
      if (dateFrom) {
        (matchFilter.transactionDate as Record<string, Date>).$gte = new Date(dateFrom);
      }
      if (dateTo) {
        (matchFilter.transactionDate as Record<string, Date>).$lte = new Date(dateTo);
      }
    }

    const ingestions = await ReconciliationIngestion.find(matchFilter)
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(5000)
      .lean();

    const matchedPaymentIds = [
      ...new Set(
        ingestions
          .filter((i) => i.matchedPaymentId)
          .map((i) => String(i.matchedPaymentId))
      ),
    ];

    const paymentsMap = new Map<string, { internalReference?: string; amountMinor: number; paymentDate: Date }>();
    if (matchedPaymentIds.length > 0) {
      const payments = await Payment.find({
        _id: { $in: matchedPaymentIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("_id internalReference amountMinor paymentDate")
        .lean();

      for (const p of payments) {
        paymentsMap.set(String(p._id), {
          internalReference: p.internalReference || undefined,
          amountMinor: p.amountMinor ?? 0,
          paymentDate: p.paymentDate,
        });
      }
    }

    const escapeCsv = (val: unknown): string => {
      if (val == null) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatMinor = (n: number) => ((n || 0) / 100).toFixed(2);
    const formatDate = (d: Date | string | null) =>
      d ? new Date(d).toISOString().slice(0, 19) + "Z" : "";

    if (formatParam === "csv") {
      const headers = [
        "externalTxnId",
        "sourceType",
        "amountMinor",
        "amountGHS",
        "transactionDate",
        "status",
        "matchMethod",
        "confidence",
        "matchedPaymentId",
        "internalReference",
        "payerName",
        "payerPhone",
        "rawReference",
        "notes",
      ];
      const rows = ingestions.map((i) => {
        const linked = i.matchedPaymentId
          ? paymentsMap.get(String(i.matchedPaymentId))
          : null;
        return [
          escapeCsv(i.externalTxnId),
          escapeCsv(i.sourceType),
          escapeCsv(i.amountMinor),
          escapeCsv(formatMinor(i.amountMinor ?? 0)),
          escapeCsv(formatDate(i.transactionDate)),
          escapeCsv(i.status),
          escapeCsv(i.matchMethod),
          escapeCsv(i.confidence ?? 0),
          escapeCsv(i.matchedPaymentId ? String(i.matchedPaymentId) : ""),
          escapeCsv(linked?.internalReference ?? ""),
          escapeCsv(i.payerName ?? ""),
          escapeCsv(i.payerPhone ?? ""),
          escapeCsv(i.rawReference ?? ""),
          escapeCsv(i.notes ?? ""),
        ].join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="reconciliation-report-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ingestions: ingestions.map((i) => ({
          id: String(i._id),
          externalTxnId: i.externalTxnId,
          sourceType: i.sourceType,
          amountMinor: i.amountMinor,
          transactionDate: i.transactionDate,
          status: i.status,
          matchMethod: i.matchMethod,
          confidence: i.confidence,
          matchedPaymentId: i.matchedPaymentId ? String(i.matchedPaymentId) : null,
          internalReference: i.matchedPaymentId
            ? paymentsMap.get(String(i.matchedPaymentId))?.internalReference
            : null,
          payerName: i.payerName,
          payerPhone: i.payerPhone,
          rawReference: i.rawReference,
          notes: i.notes,
        })),
        total: ingestions.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
