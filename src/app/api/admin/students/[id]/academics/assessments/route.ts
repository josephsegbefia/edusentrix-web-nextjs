// src/app/api/admin/students/[id]/academics/assessments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Assessment } from "@/models/Assessment";
import { SubjectGrade } from "@/models/SubjectGrade";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Subject } from "@/models/Subject";
import { Student } from "@/models/Student";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("students");
    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json({ error: "School ID not found" }, { status: 400 });
    }

    const { id: studentId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const subjectId = searchParams.get("subjectId");
    const termId = searchParams.get("termId");

    if (!subjectId || !termId) {
      return NextResponse.json(
        { error: "subjectId and termId are required" },
        { status: 400 }
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(studentId) ||
      !mongoose.Types.ObjectId.isValid(subjectId) ||
      !mongoose.Types.ObjectId.isValid(termId)
    ) {
      return NextResponse.json(
        { error: "Invalid studentId, subjectId, or termId" },
        { status: 400 }
      );
    }

    const schoolObjectId =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Verify student exists and belongs to this school
    const studentRaw = await Student.findOne({
      _id: studentId,
      schoolId: schoolObjectId,
    })
      .select("_id")
      .lean();

    // Normalize student (findById().lean() can be inferred as array by TypeScript)
    const student = (
      Array.isArray(studentRaw) ? studentRaw[0] || null : studentRaw
    ) as any;

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Verify academic period exists
    const periodRaw = await AcademicPeriod.findOne({
      _id: termId,
      schoolId: schoolObjectId,
    })
      .select("yearLabel term")
      .lean();

    // Normalize period (findOne().lean() can be inferred as array by TypeScript)
    const period = (
      Array.isArray(periodRaw) ? periodRaw[0] || null : periodRaw
    ) as any;

    if (!period) {
      return NextResponse.json(
        { error: "Academic period not found" },
        { status: 404 }
      );
    }

    // Get subject name
    const subjectRaw = await Subject.findOne({
      _id: subjectId,
      schoolId: schoolObjectId,
    })
      .select("name code")
      .lean();

    // Normalize subject (findById().lean() can be inferred as array by TypeScript)
    const subject = (
      Array.isArray(subjectRaw) ? subjectRaw[0] || null : subjectRaw
    ) as any;

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Fetch all assessments for this student + subject + term
    const assessments = await Assessment.find({
      schoolId: schoolObjectId,
      studentId,
      subjectId,
      academicPeriodId: termId,
    })
      .sort({ gradedAt: -1, createdAt: -1 })
      .lean();

    // Get SubjectGrade summary
    const subjectGradeRaw = await SubjectGrade.findOne({
      schoolId: schoolObjectId,
      studentId,
      subjectId,
      academicPeriodId: termId,
    }).lean();

    // Normalize subjectGrade (findOne().lean() can be inferred as array by TypeScript)
    const subjectGrade = (
      Array.isArray(subjectGradeRaw) ? subjectGradeRaw[0] || null : subjectGradeRaw
    ) as any;

    const termLabel = `${period.yearLabel} • ${period.term}`;

    return NextResponse.json({
      success: true,
      data: {
        subjectId,
        subjectName: subject.name,
        termId,
        termLabel,
        assessments: assessments.map((a: any) => ({
          id: String(a._id),
          assessmentType: a.assessmentType,
          title: a.title,
          score: a.score,
          maxScore: a.maxScore,
          percentage: a.percentage,
          weight: a.weight,
          gradedAt: a.gradedAt ? a.gradedAt.toISOString() : null,
          remarks: a.remarks ?? null,
          createdAt: a.createdAt.toISOString(),
        })),
        summary: subjectGrade
          ? {
              caTotal: subjectGrade.caTotal,
              caMaxTotal: subjectGrade.caMaxTotal,
              examScore: subjectGrade.examScore,
              examMaxScore: subjectGrade.examMaxScore,
              totalScore: subjectGrade.totalScore,
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("Error fetching assessment breakdown:", error);
    return NextResponse.json(
      { error: "Failed to fetch assessment breakdown" },
      { status: 500 }
    );
  }
}
