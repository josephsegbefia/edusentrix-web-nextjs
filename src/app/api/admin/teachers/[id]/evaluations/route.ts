// src/app/api/admin/teachers/[id]/evaluations/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherPerformance } from "@/models/TeacherPerformance";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/:id/evaluations
 * Get all evaluations for a teacher across all academic periods
 * Query params: page, limit
 * Returns evaluations sorted by date (newest first)
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));

  if (!teacherObjId) {
    return Response.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  // Get all performance records for the teacher
  const performanceRecords = await TeacherPerformance.find({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  })
    .populate("academicPeriodId", "yearLabel term startDate endDate")
    .populate("evaluations.evaluatorId", "firstName lastName email")
    .lean();

  // Flatten evaluations and add academic period info
  const allEvaluations: any[] = [];
  performanceRecords.forEach((record: any) => {
    if (Array.isArray(record.evaluations) && record.evaluations.length > 0) {
      record.evaluations.forEach((evaluation: any) => {
        allEvaluations.push({
          ...evaluation,
          academicPeriod: record.academicPeriodId
            ? {
                id: String(record.academicPeriodId._id),
                yearLabel: record.academicPeriodId.yearLabel,
                term: record.academicPeriodId.term,
                startDate: new Date(record.academicPeriodId.startDate).toISOString(),
                endDate: new Date(record.academicPeriodId.endDate).toISOString(),
              }
            : null,
          performanceId: String(record._id),
        });
      });
    }
  });

  // Sort by date (newest first)
  allEvaluations.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA;
  });

  const total = allEvaluations.length;

  // Paginate
  const paginatedEvaluations = allEvaluations.slice(
    (page - 1) * limit,
    page * limit
  );

  // Format evaluations
  const data = paginatedEvaluations.map((evaluation: any) => ({
    date: new Date(evaluation.date).toISOString(),
    evaluator: evaluation.evaluatorId
      ? {
          id: String(evaluation.evaluatorId._id),
          name: `${evaluation.evaluatorId.firstName || ""} ${evaluation.evaluatorId.lastName || ""}`.trim(),
          email: evaluation.evaluatorId.email || null,
        }
      : null,
    overallRating: evaluation.overallRating,
    strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
    areasForImprovement: Array.isArray(evaluation.areasForImprovement)
      ? evaluation.areasForImprovement
      : [],
    goals: Array.isArray(evaluation.goals) ? evaluation.goals : [],
    comments: evaluation.comments || null,
    academicPeriod: evaluation.academicPeriod,
    performanceId: evaluation.performanceId,
  }));

  return Response.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
