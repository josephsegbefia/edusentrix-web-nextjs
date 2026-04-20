/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { listGhanaBanks } from "@/lib/paystack";
import { connectToDatabase } from "@/db/connectToDatabase";
import { BankBranch } from "@/models/BankBranch";

function pickPaystackMatches(
  rows: Array<{ name: string; code: string }>,
  queryLower: string
): Array<{ name: string; code: string }> {
  if (!queryLower) {
    return rows;
  }
  const direct = rows.filter((b) =>
    b.name.toLowerCase().includes(queryLower)
  );
  if (direct.length > 0) {
    return direct;
  }
  const tokens = queryLower.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length > 0) {
    const loose = rows.filter((b) => {
      const n = b.name.toLowerCase();
      return tokens.every((t) => n.includes(t));
    });
    if (loose.length > 0) {
      return loose;
    }
  }
  // No substring / token hit — still return the catalogue so the UI isn’t empty (typo / abbreviation).
  return rows;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").trim().toLowerCase();

  try {
    // Try Paystack first
    let banks: Array<{ bankName: string; branchName: string; sortCode: string }> = [];

    try {
      const paystackData = await listGhanaBanks();
      if (Array.isArray(paystackData) && paystackData.length > 0) {
        const picked = pickPaystackMatches(paystackData, query);
        banks = picked.slice(0, 20).map((b) => ({
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

    return NextResponse.json(
      { success: true, data: banks },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
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
