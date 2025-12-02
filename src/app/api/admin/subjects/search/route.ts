/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Subject } from "@/models/Subject";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 12), 50);

    const filter: any = { schoolId, isActive: true };
    if (q) {
      filter.name = {
        $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

    const items = await Subject.find(filter)
      .select("_id name")
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    return Response.json({ success: true, data: items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to search subjects";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
