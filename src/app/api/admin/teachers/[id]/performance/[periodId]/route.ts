// src/app/api/admin/teachers/[id]/performance/[periodId]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherPerformance } from "@/models/TeacherPerformance";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { SubjectGrade } from "@/models/SubjectGrade";
import { TeacherAttendance } from "@/models/TeacherAttendance";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/teachers/:id/performance/:periodId
 * Get performance record for a specific academic period
 * Calculates metrics if they don't exist
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; periodId: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id, periodId } = await ctx.params;
  const teacherObjId = toObjectIdOrNull(String(id));
  const periodObjId = toObjectIdOrNull(String(periodId));

  if (!teacherObjId || !periodObjId) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  // Verify academic period exists and belongs to school
  const academicPeriod = await AcademicPeriod.findOne({
    _id: periodObjId,
    schoolId: schoolIdObj,
  }).lean() as { _id: any; startDate: Date; endDate: Date; yearLabel: string; term: string } | null;

  if (!academicPeriod) {
    return Response.json({ error: "Academic period not found" }, { status: 404 });
  }

  // Find or create performance record
  let performance = await TeacherPerformance.findOne({
    teacherId: teacherObjId,
    schoolId: schoolIdObj,
    academicPeriodId: periodObjId,
  }).lean() as Record<string, any> | null;

  // Calculate metrics
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

  // Calculate teacher attendance rate
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

  // If performance record doesn't exist, return calculated metrics without creating it
  if (!performance) {
    return Response.json({
      success: true,
      data: {
        id: null,
        academicPeriod: {
          id: String(academicPeriod._id),
          yearLabel: academicPeriod.yearLabel,
          term: academicPeriod.term,
          startDate: new Date(academicPeriod.startDate).toISOString(),
          endDate: new Date(academicPeriod.endDate).toISOString(),
        },
        averageStudentGrade: averageGrade,
        studentPassRate: passRate,
        classAttendanceRate: null, // Not calculated yet
        teacherAttendanceRate: teacherAttendanceRate,
        evaluations: [],
        pdCompleted: [],
        notes: null,
        createdAt: null,
        updatedAt: null,
      },
    });
  }

  // Return performance record with calculated metrics
  return Response.json({
    success: true,
    data: {
      id: String(performance._id),
      academicPeriod: {
        id: String(academicPeriod._id),
        yearLabel: academicPeriod.yearLabel,
        term: academicPeriod.term,
        startDate: new Date(academicPeriod.startDate).toISOString(),
        endDate: new Date(academicPeriod.endDate).toISOString(),
      },
      averageStudentGrade: performance.averageStudentGrade ?? averageGrade,
      studentPassRate: performance.studentPassRate ?? passRate,
      classAttendanceRate: performance.classAttendanceRate ?? null,
      teacherAttendanceRate: performance.teacherAttendanceRate ?? teacherAttendanceRate,
      evaluations: Array.isArray(performance.evaluations)
        ? performance.evaluations.map((evaluation: any) => ({
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
      pdCompleted: Array.isArray(performance.pdCompleted)
        ? performance.pdCompleted.map((pd: any) => ({
            name: pd.name,
            date: new Date(pd.date).toISOString(),
            hours: pd.hours,
            certificateUrl: pd.certificateUrl || null,
          }))
        : [],
      notes: performance.notes || null,
      createdAt: new Date(performance.createdAt).toISOString(),
      updatedAt: new Date(performance.updatedAt).toISOString(),
    },
  });
}
