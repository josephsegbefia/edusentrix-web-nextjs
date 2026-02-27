// src/app/api/admin/promotions/cycles/[cycleId]/decisions/route.ts
// PROMO-BE-004: GET cycle decisions with pagination
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PromotionDecision } from "@/models/PromotionDecision";
import { Student } from "@/models/Student";
import mongoose from "mongoose";

function parsePositiveInt(val: string | null, defaultVal: number): number {
  if (!val) return defaultVal;
  const n = parseInt(val, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : defaultVal;
}

/**
 * GET /api/admin/promotions/cycles/:cycleId/decisions
 * Paginated with filters: page, limit, outcome, conflict, gradeId, classGroupId, search
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ cycleId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { cycleId } = await ctx.params;
    if (!cycleId) {
      return NextResponse.json(
        { success: false, error: "Cycle ID is required" },
        { status: 400 }
      );
    }

    let cycleObjId: mongoose.Types.ObjectId;
    try {
      cycleObjId = new mongoose.Types.ObjectId(cycleId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid cycle ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 50);
    const outcome = searchParams.get("outcome")?.trim();
    const conflict = searchParams.get("conflict")?.trim();
    const gradeId = searchParams.get("gradeId")?.trim();
    const classGroupId = searchParams.get("classGroupId")?.trim();
    const search = searchParams.get("search")?.trim();

    const match: Record<string, unknown> = {
      schoolId: schoolIdObj,
      cycleId: cycleObjId,
    };
    if (outcome) match.finalOutcome = outcome;
    if (conflict) match.conflicts = conflict;
    if (gradeId) match.fromGradeId = new mongoose.Types.ObjectId(gradeId);
    if (classGroupId) match.fromClassGroupId = new mongoose.Types.ObjectId(classGroupId);

    let studentIds: mongoose.Types.ObjectId[] | null = null;
    if (search) {
      const searchRegex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      const students = await Student.find({
        schoolId: schoolIdObj,
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { admissionNo: searchRegex },
        ],
      })
        .select("_id")
        .lean();
      studentIds = students.map((s) => s._id);
      if (studentIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
      match.studentId = { $in: studentIds };
    }

    const [items, total] = await Promise.all([
      PromotionDecision.find(match)
        .sort({ finalOutcome: 1, studentId: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("studentId", "firstName lastName admissionNo")
        .populate("fromGradeId", "name")
        .populate("fromClassGroupId", "name")
        .populate("targetGradeId", "name")
        .populate("targetClassGroupId", "name")
        .lean(),
      PromotionDecision.countDocuments(match),
    ]);

    const data = items.map((d: Record<string, unknown>) => {
      const student = d.studentId as { _id: unknown; firstName?: string; lastName?: string; admissionNo?: string } | null;
      const fromGrade = d.fromGradeId as { _id: unknown; name?: string } | null;
      const fromClass = d.fromClassGroupId as { _id: unknown; name?: string } | null;
      const targetGrade = d.targetGradeId as { _id: unknown; name?: string } | null;
      const targetClass = d.targetClassGroupId as { _id: unknown; name?: string } | null;

      return {
        id: String(d._id),
        studentId: String(d.studentId),
        studentName: student
          ? `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim()
          : "—",
        admissionNo: student?.admissionNo ?? null,
        fromGradeId: String(d.fromGradeId),
        fromGradeName: fromGrade?.name ?? "—",
        fromClassGroupId: String(d.fromClassGroupId),
        fromClassGroupName: fromClass?.name ?? "—",
        targetGradeId: d.targetGradeId ? String(d.targetGradeId) : null,
        targetGradeName: targetGrade?.name ?? null,
        targetClassGroupId: d.targetClassGroupId ? String(d.targetClassGroupId) : null,
        targetClassGroupName: targetClass?.name ?? null,
        recommendedOutcome: d.recommendedOutcome,
        finalOutcome: d.finalOutcome,
        source: d.source,
        reasonCodes: d.reasonCodes ?? [],
        conflicts: d.conflicts ?? [],
        evidence: d.evidence,
        isApplied: d.isApplied,
        version: d.version,
      };
    });

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Promotion decisions GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch decisions" },
      { status: 500 }
    );
  }
}
