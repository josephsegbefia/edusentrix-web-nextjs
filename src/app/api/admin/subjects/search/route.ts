/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/subjects/search/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { Subject } from "@/models/Subject";
import { escapeRegex, parsePositiveInt } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 10), 25);

    const query: any = { schoolId: schoolIdObj };
    if (q) query.name = new RegExp(escapeRegex(q), "i");

    const items = await Subject.find(query)
      .select("_id name")
      .limit(limit)
      .lean();

    return Response.json({
      success: true,
      data: (items || []).map((s: any) => ({
        id: String(s._id),
        name: String(s.name),
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to search subjects";
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
