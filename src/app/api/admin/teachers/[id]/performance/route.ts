// src/app/api/admin/teachers/[id]/performance/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherPerformance } from "@/models/TeacherPerformance";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { SubjectGrade } from "@/models/SubjectGrade";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import mongoose from "mongoose";
import { z } from "zod";
import { CreateEvaluationSchema } from "@/schemas/teacher";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/:id/performance
 * Get performance records for a teacher
 * Query params: page, limit
 * Returns all performance records sorted by academic period (newest first)
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

  // Get performance records
  const total = await TeacherPerformance.countDocuments({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  });

  const performanceRecords = await TeacherPerformance.find({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
  })
    .populate("academicPeriodId", "yearLabel term startDate endDate")
    .sort({ "academicPeriodId.startDate": -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const data = performanceRecords.map((record: any) => ({
    id: String(record._id),
    academicPeriod: record.academicPeriodId
      ? {
          id: String(record.academicPeriodId._id),
          yearLabel: record.academicPeriodId.yearLabel,
          term: record.academicPeriodId.term,
          startDate: new Date(record.academicPeriodId.startDate).toISOString(),
          endDate: new Date(record.academicPeriodId.endDate).toISOString(),
        }
      : null,
    averageStudentGrade: record.averageStudentGrade ?? null,
    studentPassRate: record.studentPassRate ?? null,
    classAttendanceRate: record.classAttendanceRate ?? null,
    teacherAttendanceRate: record.teacherAttendanceRate ?? null,
    evaluations: Array.isArray(record.evaluations)
      ? record.evaluations.map((evaluation: any) => ({
          date: new Date(evaluation.date).toISOString(),
          evaluatorId: String(evaluation.evaluatorId),
          overallRating: evaluation.overallRating,
          strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
          areasForImprovement: Array.isArray(evaluation.areasForImprovement)
            ? evaluation.areasForImprovement
            : [],
          goals: Array.isArray(evaluation.goals) ? evaluation.goals : [],
          comments: evaluation.comments || null,
        }))
      : [],
    pdCompleted: Array.isArray(record.pdCompleted)
      ? record.pdCompleted.map((pd: any) => ({
          name: pd.name,
          date: new Date(pd.date).toISOString(),
          hours: pd.hours,
          certificateUrl: pd.certificateUrl || null,
        }))
      : [],
    notes: record.notes || null,
    createdAt: new Date(record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt).toISOString(),
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

/**
 * POST /api/admin/teachers/:id/performance
 * Record an evaluation for a teacher
 * Creates or updates a TeacherPerformance record for the given academic period
 * Adds an evaluation to the evaluations array
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
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

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateEvaluationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const periodObjId = toObjectIdOrNull(input.academicPeriodId);

  if (!periodObjId) {
    return Response.json({ error: "Invalid academic period id" }, { status: 400 });
  }

  // Verify academic period exists and belongs to school
  const academicPeriod = await AcademicPeriod.findOne({
    _id: periodObjId,
    schoolId: schoolIdObj,
  });

  if (!academicPeriod) {
    return Response.json({ error: "Academic period not found" }, { status: 404 });
  }

  const evaluatorObjId = adminUserId
    ? new mongoose.Types.ObjectId(String(adminUserId))
    : null;

  if (!evaluatorObjId) {
    return Response.json({ error: "Evaluator not found" }, { status: 400 });
  }

  // Find or create performance record
  let performance = await TeacherPerformance.findOne({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
    academicPeriodId: periodObjId,
  });

  // Calculate metrics if performance record doesn't exist or metrics are missing
  const needsMetrics =
    !performance ||
    performance.averageStudentGrade === null ||
    performance.studentPassRate === null ||
    performance.teacherAttendanceRate === null;

  if (needsMetrics) {
    // Calculate average student grade and pass rate from SubjectGrade
    const subjectGrades = await SubjectGrade.find({
      teacherId: teacherObjId,
      schoolId: schoolIdObj,
      academicPeriodId: periodObjId,
    }).lean();

    let averageGrade: number | null = null;
    let passRate: number | null = null;

    if (subjectGrades.length > 0) {
      const totalScore = subjectGrades.reduce((sum, grade) => sum + (grade.totalScore || 0), 0);
      const totalMax = subjectGrades.reduce((sum, grade) => sum + (grade.caMaxTotal || 0) + (grade.examMaxScore || 0), 0);

      if (totalMax > 0) {
        averageGrade = (totalScore / totalMax) * 100;
      }

      const passed = subjectGrades.filter((grade) => grade.isPassed === true).length;
      passRate = (passed / subjectGrades.length) * 100;
    }

    // Calculate teacher attendance rate from TeacherAttendance
    const startDate = new Date(academicPeriod.startDate);
    const endDate = new Date(academicPeriod.endDate);

    const attendanceRecords = await TeacherAttendance.find({
      teacherId: teacherObjId,
      schoolId: schoolIdObj,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    let teacherAttendanceRate: number | null = null;

    if (attendanceRecords.length > 0) {
      const present = attendanceRecords.filter(
        (record) => record.status === "present"
      ).length;
      teacherAttendanceRate = (present / attendanceRecords.length) * 100;
    }

    if (!performance) {
      // Create new performance record
      performance = await TeacherPerformance.create({
        teacherId: teacherObjId,
        schoolId: schoolIdObj,
        academicPeriodId: periodObjId,
        averageStudentGrade: averageGrade,
        studentPassRate: passRate,
        teacherAttendanceRate: teacherAttendanceRate,
        evaluations: [],
        pdCompleted: [],
      });
    } else {
      // Update metrics if missing
      await TeacherPerformance.findByIdAndUpdate(performance._id, {
        $set: {
          averageStudentGrade: performance.averageStudentGrade ?? averageGrade,
          studentPassRate: performance.studentPassRate ?? passRate,
          teacherAttendanceRate: performance.teacherAttendanceRate ?? teacherAttendanceRate,
        },
      });
    }
  }

  // Add evaluation to evaluations array
  const newEvaluation = {
    date: new Date(),
    evaluatorId: evaluatorObjId,
    overallRating: input.overallRating,
    strengths: input.strengths || [],
    areasForImprovement: input.areasForImprovement || [],
    goals: input.goals || [],
    comments: input.comments || undefined,
  };

  await TeacherPerformance.findByIdAndUpdate(performance._id, {
    $push: { evaluations: newEvaluation },
  });

  // Log activity
  await logTeacherActivity({
    teacherId: String(teacherObjId),
    schoolId: schoolIdObj,
    type: "performance.evaluated",
    title: "Performance evaluation recorded",
    description: `Performance evaluation recorded with rating ${input.overallRating}/5`,
    metadata: {
      academicPeriodId: input.academicPeriodId,
      overallRating: input.overallRating,
      evaluatorId: adminUserId,
    },
    createdBy: adminUserId,
  });

  return Response.json({
    success: true,
    message: "Evaluation recorded successfully",
    data: {
      id: String(performance._id),
      evaluation: newEvaluation,
    },
  });
}
