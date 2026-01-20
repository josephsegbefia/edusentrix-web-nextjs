/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/class-groups/search/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
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

    const items = await ClassGroup.find(query)
      .select("_id name gradeId")
      .limit(limit)
      .populate({ path: "gradeId", select: "name", model: Grade })
      .lean();

    return Response.json({
      success: true,
      data: (items || []).map((g: any) => {
        const gradeName = g.gradeId?.name ? String(g.gradeId.name) : null;
        return {
          id: String(g._id),
          name: String(g.name),
          gradeName,
          label: gradeName ? `${gradeName} ${String(g.name)}` : String(g.name),
        };
      }),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to search class groups";
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
