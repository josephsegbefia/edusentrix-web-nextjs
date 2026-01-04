// src/app/api/admin/students/[id]/academics/assessments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Assessment } from "@/models/Assessment";
import { SubjectGrade } from "@/models/SubjectGrade";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Subject } from "@/models/Subject";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    await connectToDatabase();

    // Verify student exists and get schoolId
    const { Student } = await import("@/models/Student");
    const studentRaw = await Student.findById(studentId)
      .select("schoolId")
      .lean();

    // Normalize student (findById().lean() can be inferred as array by TypeScript)
    const student = (
      Array.isArray(studentRaw) ? studentRaw[0] || null : studentRaw
    ) as any;

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const schoolId = student.schoolId.toString();

    // Verify academic period exists
    const periodRaw = await AcademicPeriod.findOne({
      _id: termId,
      schoolId,
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
    const subjectRaw = await Subject.findById(subjectId)
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
      schoolId,
      studentId,
      subjectId,
      academicPeriodId: termId,
    })
      .sort({ gradedAt: -1, createdAt: -1 })
      .lean();

    // Get SubjectGrade summary
    const subjectGradeRaw = await SubjectGrade.findOne({
      schoolId,
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
        assessments: assessments.map((a) => ({
          id: a._id.toString(),
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
    console.error("Error fetching assessment breakdown:", error);
    return NextResponse.json(
      { error: "Failed to fetch assessment breakdown" },
      { status: 500 }
    );
  }
}
