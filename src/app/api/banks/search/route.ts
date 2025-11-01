/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { listGhanaBanks } from "@/lib/paystack";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("query") || "").toLowerCase();

  try {
    const data = await listGhanaBanks(); // [{ name, code }]
    const filtered = data
      .filter((b) => !query || b.name.toLowerCase().includes(query))
      .slice(0, 20)
      .map((b) => ({
        bankName: b.name,
        branchName: "—", // optional/unused; you can drop branch UI entirely
        sortCode: b.code, // <= IMPORTANT: Paystack bank code
      }));

    return NextResponse.json({ success: true, data: filtered });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to fetch banks" },
      { status: 500 }
    );
  }
}
