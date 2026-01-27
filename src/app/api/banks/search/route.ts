/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { listGhanaBanks } from "@/lib/paystack";
import { connectToDatabase } from "@/db/connectToDatabase";
import { BankBranch } from "@/models/BankBranch";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").trim().toLowerCase();

  try {
    // Try Paystack first
    let banks: Array<{ bankName: string; branchName: string; sortCode: string }> = [];

    try {
      const paystackData = await listGhanaBanks();
      if (Array.isArray(paystackData) && paystackData.length > 0) {
        banks = paystackData
          .filter((b) => !query || b.name.toLowerCase().includes(query))
          .slice(0, 20)
          .map((b) => ({
            bankName: b.name,
            branchName: "—",
            sortCode: b.code,
          }));
      }
    } catch (paystackError: any) {
      console.warn("Paystack bank fetch failed, falling back to database:", paystackError?.message);
    }

    // Fallback to database if Paystack failed or returned no results
    if (banks.length === 0) {
      await connectToDatabase();

      const searchRegex = query ? new RegExp(query, "i") : undefined;
      const dbQuery: any = { isActive: true };

      if (searchRegex) {
        dbQuery.$or = [
          { bankName: searchRegex },
          { branchName: searchRegex },
          { sortCode: searchRegex },
        ];
      }

      const dbBanks = await BankBranch.find(dbQuery)
        .select("bankName branchName sortCode")
        .limit(20)
        .lean();

      banks = dbBanks.map((b) => ({
        bankName: b.bankName,
        branchName: b.branchName,
        sortCode: b.sortCode,
      }));
    }

    return NextResponse.json({ success: true, data: banks });
  } catch (e: any) {
    console.error("Bank search API error:", {
      message: e?.message,
      stack: e?.stack,
      query,
    });

    const errorMessage = process.env.NODE_ENV === "development"
      ? e?.message || "Failed to fetch banks"
      : "Failed to fetch banks. Please try again later.";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        ...(process.env.NODE_ENV === "development" && { details: e?.stack })
      },
      { status: 500 }
    );
  }
}
