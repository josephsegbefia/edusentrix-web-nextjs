// src/app/api/admin/admissions/applications/route.ts
// Admin applications inbox. Supports query params:
//   ?cycleId=<id>   restrict to one cycle (recommended)
//   ?status=<csv>   filter by status (e.g. submitted,under_review)
//   ?gradeId=<id>   filter by intended grade
//   ?q=<text>       search reference code / applicant / guardian name / email
//   ?page=<n>&pageSize=<n>  pagination (default page 1, size 25, max 100)

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { Grade } from "@/models/Grade";
import { requireAdmissionsManager } from "@/lib/auth/requireAdmissionsManager";
import { serializeApplicationListItem } from "@/lib/admissions/application-service";
import { requireAdmissionsPermission } from "@/lib/admissions/admissions-api-permissions";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAdmissionsManager();
    requireAdmissionsPermission(ctx, "admissions.view");
    await connectToDatabase();

    const url = new URL(req.url);
    const cycleId = url.searchParams.get("cycleId");
    const status = url.searchParams.get("status");
    const gradeId = url.searchParams.get("gradeId");
    const q = url.searchParams.get("q")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(5, Number(url.searchParams.get("pageSize") ?? "25"))
    );

    const filter: Record<string, unknown> = { schoolId: ctx.schoolId };

    if (cycleId && mongoose.Types.ObjectId.isValid(cycleId)) {
      filter.cycleId = new mongoose.Types.ObjectId(cycleId);
    }
    if (status) {
      const list = status.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length === 1) filter.status = list[0];
      else if (list.length > 1) filter.status = { $in: list };
    }
    if (gradeId && mongoose.Types.ObjectId.isValid(gradeId)) {
      filter["applicant.intendedGradeId"] = new mongoose.Types.ObjectId(gradeId);
    }
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { referenceCode: rx },
        { "applicant.firstName": rx },
        { "applicant.lastName": rx },
        { "guardian.firstName": rx },
        { "guardian.lastName": rx },
        { "guardian.email": rx },
        { "guardian.phone": rx },
      ];
    }

    const [items, total] = await Promise.all([
      AdmissionApplication.find(filter)
        .sort({ submittedAt: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      AdmissionApplication.countDocuments(filter),
    ]);

    const gradeIds = Array.from(
      new Set(
        items
          .map((a) => a.applicant?.intendedGradeId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    );
    const grades = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds } })
          .select({ _id: 1, name: 1 })
          .lean()
      : [];
    const gradeNameById = new Map<string, string>(
      grades.map((g) => [String(g._id), String(g.name)])
    );

    const data = items.map((app) =>
      serializeApplicationListItem({
        ...app,
        _gradeName: app.applicant?.intendedGradeId
          ? gradeNameById.get(String(app.applicant.intendedGradeId)) ?? null
          : null,
      } as never)
    );

    // Aggregate counts by status for the inbox kanban totals.
    const counts = await AdmissionApplication.aggregate([
      { $match: { schoolId: ctx.schoolId, ...(cycleId && mongoose.Types.ObjectId.isValid(cycleId) ? { cycleId: new mongoose.Types.ObjectId(cycleId) } : {}) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const statusCounts: Record<string, number> = {};
    for (const c of counts) statusCounts[String(c._id)] = c.count as number;

    return NextResponse.json({
      success: true,
      data: {
        items: data,
        page,
        pageSize,
        total,
        statusCounts,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Admin admissions list error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load applications" },
      { status: 500 }
    );
  }
}
