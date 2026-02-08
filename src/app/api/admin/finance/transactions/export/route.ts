// src/app/api/admin/finance/transactions/export/route.ts
// Export financial transactions as CSV

import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaff } from "@/lib/auth/requireFinanceStaff";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  FinancialTransaction,
  TransactionStatus,
  TransactionCategory,
  TransactionSourceModule,
  ReconciliationStatus,
} from "@/models/FinancialTransaction";
import mongoose from "mongoose";
import { format } from "date-fns/format";

// ========================
// Types
// ========================

interface TransactionLean {
  _id: mongoose.Types.ObjectId;
  direction: string;
  status: string;
  grossAmountMinor: number;
  feeAmountMinor: number;
  netAmountMinor: number;
  currency: string;
  occurredAt: Date;
  category: string;
  sourceModule: string;
  method: string;
  channel?: string | null;
  reference?: string | null;
  description?: string | null;
  party?: {
    type: string;
    name: string;
    contact?: {
      email?: string | null;
      phone?: string | null;
    };
  } | null;
  reconciliation?: {
    status: string;
  } | null;
  createdAt: Date;
}

// ========================
// GET Handler
// ========================

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireFinanceStaff();
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;

    // Filters
    const status = searchParams.get("status");
    const direction = searchParams.get("direction");
    const category = searchParams.get("category");
    const sourceModule = searchParams.get("sourceModule");
    const reconciliationStatus = searchParams.get("reconciliationStatus");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const exportFormat = searchParams.get("format") || "csv";

    // Build query
    const query: Record<string, unknown> = {
      schoolId: new mongoose.Types.ObjectId(String(schoolId)),
    };

    if (status) {
      const statuses = status.split(",") as TransactionStatus[];
      query.status = { $in: statuses };
    }

    if (direction) {
      query.direction = direction;
    }

    if (category) {
      const categories = category.split(",") as TransactionCategory[];
      query.category = { $in: categories };
    }

    if (sourceModule) {
      const modules = sourceModule.split(",") as TransactionSourceModule[];
      query.sourceModule = { $in: modules };
    }

    if (reconciliationStatus) {
      const statuses = reconciliationStatus
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean) as ReconciliationStatus[];
      if (statuses.length === 1) {
        query["reconciliation.status"] = statuses[0];
      } else if (statuses.length > 1) {
        query["reconciliation.status"] = { $in: statuses };
      }
    }

    if (dateFrom || dateTo) {
      query.occurredAt = {};
      if (dateFrom) {
        (query.occurredAt as Record<string, Date>).$gte = new Date(dateFrom);
      }
      if (dateTo) {
        (query.occurredAt as Record<string, Date>).$lte = new Date(dateTo);
      }
    }

    // Fetch transactions (limit to 5000 for export)
    const transactions = (await FinancialTransaction.find(query)
      .sort({ occurredAt: -1 })
      .limit(5000)
      .lean()) as unknown as TransactionLean[];

    // Format amount
    const formatAmount = (minor: number) => (minor / 100).toFixed(2);

    // Format category
    const formatCategory = (cat: string) => {
      const labels: Record<string, string> = {
        fees: "Fees",
        store: "Store",
        fundraising: "Fundraising",
        expenses: "Expenses",
        other_income: "Other Income",
        refund: "Refund",
        adjustment: "Adjustment",
        gateway_fee: "Gateway Fee",
        bank_charge: "Bank Charge",
        penalty: "Penalty",
        discount: "Discount",
      };
      return labels[cat] || cat;
    };

    // Format method
    const formatMethod = (method: string) => {
      const labels: Record<string, string> = {
        cash: "Cash",
        mobile_money: "Mobile Money",
        bank_transfer: "Bank Transfer",
        card: "Card",
        cheque: "Cheque",
        other: "Other",
      };
      return labels[method] || method;
    };

    if (exportFormat === "csv") {
      // Generate CSV
      const headers = [
        "Date",
        "Reference",
        "Description",
        "Direction",
        "Category",
        "Source",
        "Payment Method",
        "Gross Amount",
        "Fee",
        "Net Amount",
        "Currency",
        "Status",
        "Party Name",
        "Party Type",
        "Party Email",
        "Party Phone",
        "Reconciliation",
      ];

      const rows = transactions.map((tx) => [
        format(new Date(tx.occurredAt), "yyyy-MM-dd HH:mm:ss"),
        tx.reference || "",
        (tx.description || "").replace(/,/g, ";"), // Escape commas
        tx.direction === "inflow" ? "Inflow" : "Outflow",
        formatCategory(tx.category),
        tx.sourceModule,
        formatMethod(tx.method),
        formatAmount(tx.grossAmountMinor),
        formatAmount(tx.feeAmountMinor),
        formatAmount(tx.netAmountMinor),
        tx.currency,
        tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
        tx.party?.name || "",
        tx.party?.type || "",
        tx.party?.contact?.email || "",
        tx.party?.contact?.phone || "",
        tx.reconciliation?.status || "unmatched",
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

      const filename = `transactions-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // JSON export (for flexibility)
    return NextResponse.json({
      data: transactions.map((tx) => ({
        date: format(new Date(tx.occurredAt), "yyyy-MM-dd HH:mm:ss"),
        reference: tx.reference,
        description: tx.description,
        direction: tx.direction,
        category: formatCategory(tx.category),
        sourceModule: tx.sourceModule,
        method: formatMethod(tx.method),
        grossAmount: formatAmount(tx.grossAmountMinor),
        feeAmount: formatAmount(tx.feeAmountMinor),
        netAmount: formatAmount(tx.netAmountMinor),
        currency: tx.currency,
        status: tx.status,
        partyName: tx.party?.name || null,
        partyType: tx.party?.type || null,
        partyEmail: tx.party?.contact?.email || null,
        partyPhone: tx.party?.contact?.phone || null,
        reconciliation: tx.reconciliation?.status || "unmatched",
      })),
      meta: {
        count: transactions.length,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error exporting transactions:", error);
    return NextResponse.json(
      { error: "Failed to export transactions" },
      { status: 500 }
    );
  }
}
