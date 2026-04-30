/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { BankBranch } from "@/models/BankBranch";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").trim().toLowerCase();

  try {
    await connectToDatabase();

    const searchRegex = query ? new RegExp(escapeRegex(query), "i") : undefined;
    const dbQuery: any = { isActive: true };

    if (searchRegex) {
      dbQuery.$or = [
        { bankName: searchRegex },
        { branchName: searchRegex },
        { sortCode: searchRegex },
        { bankNameNormalized: searchRegex },
        { branchNameNormalized: searchRegex },
      ];
    }

    const dbBanks = await BankBranch.find(dbQuery)
      .select("bankName branchName sortCode")
      .sort({ bankName: 1, branchName: 1 })
      .limit(30)
      .lean();

    const banks = dbBanks.map((b) => ({
      bankName: b.bankName,
      branchName: b.branchName,
      sortCode: b.sortCode,
    }));

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
