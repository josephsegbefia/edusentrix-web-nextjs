// src/app/api/banks/search/route.ts
export const runtime = "nodejs";

import connectToDatabase from "@/db/connectToDatabase";
import { BankBranch } from "@/models/BankBranch";
import { NextResponse } from "next/server";

// Returns up to 20 matches across bankName, branchName, or sortCode-prefix
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").trim();

  if (!query) return NextResponse.json({ items: [] });

  await connectToDatabase();

  // escape regex special chars
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const textRe = new RegExp(esc, "i");
  const codeRe = new RegExp("^" + esc); // sortCode prefix

  const items = await BankBranch.find(
    {
      $or: [
        { bankName: textRe },
        { branchName: textRe },
        { sortCode: { $regex: codeRe } },
      ],
    },
    { _id: 0, bankName: 1, branchName: 1, sortCode: 1 }
  )
    .limit(20)
    .lean()
    .exec();

  return NextResponse.json({ items });
}
