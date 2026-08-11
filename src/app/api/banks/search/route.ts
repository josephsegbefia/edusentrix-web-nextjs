/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { BankBranch } from "@/models/BankBranch";
import { listGhanaBanksCached } from "@/lib/paystack";

type BankSearchItem = {
  bankName: string;
  branchName: string;
  sortCode: string;
  source: "database" | "paystack";
};

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesQuery(item: { name: string; code: string }, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    item.name.toLowerCase().includes(q) ||
    item.code.toLowerCase().includes(q)
  );
}

async function getPaystackBanks(query: string): Promise<BankSearchItem[]> {
  const banks = await listGhanaBanksCached();
  return banks
    .filter((bank) => matchesQuery(bank, query))
    .map((bank) => ({
      bankName: bank.name,
      branchName: bank.name,
      sortCode: bank.code,
      source: "paystack" as const,
    }))
    .slice(0, 30);
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

    const banks: BankSearchItem[] = dbBanks.map((b) => ({
      bankName: b.bankName,
      branchName: b.branchName,
      sortCode: b.sortCode,
      source: "database",
    }));

    if (banks.length === 0) {
      try {
        const paystackBanks = await getPaystackBanks(query);
        return NextResponse.json(
          { success: true, data: paystackBanks },
          {
            headers: {
              "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
            },
          }
        );
      } catch (paystackError: any) {
        console.error("Paystack bank fallback error:", {
          message: paystackError?.message,
          query,
        });
      }
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

    try {
      const paystackBanks = await getPaystackBanks(query);
      return NextResponse.json(
        {
          success: true,
          data: paystackBanks,
          warning: "Using Paystack bank list because the branch database is unavailable.",
        },
        {
          headers: {
            "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
          },
        }
      );
    } catch (paystackError: any) {
      console.error("Paystack bank fallback error:", {
        message: paystackError?.message,
        query,
      });
    }

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
