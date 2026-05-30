// src/app/api/parent/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { listReleasedStudentReportCards } from "@/lib/academics/reporting/load-student-report-card";

type GuardianLink = {
  studentId: mongoose.Types.ObjectId;
};

type StudentRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  classGroupId?: mongoose.Types.ObjectId;
};

type ClassGroupRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
};

type AcademicPeriodRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  label?: string;
};

interface AvailableReport {
  id: string;
  type: "report_card";
  title: string;
  wardId: string;
  wardName: string;
  periodId: string;
  periodLabel: string;
  classGroup: string;
  status: "available" | "pending" | "not_available";
  generatedAt: string | null;
  averageScore: number | null;
  classPosition: number | null;
  studentReportCardId: string;
  source: "snapshot";
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const wardId = searchParams.get("wardId");

    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean<GuardianLink[]>();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: { wards: [], reports: [], periods: [] },
      });
    }

    let studentIds = guardians.map((g) => g.studentId);

    if (wardId && mongoose.Types.ObjectId.isValid(wardId)) {
      const wardObjectId = new mongoose.Types.ObjectId(wardId);
      if (studentIds.some((id) => id.equals(wardObjectId))) {
        studentIds = [wardObjectId];
      }
    }

    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName classGroupId")
      .lean<StudentRow[]>();

    const classGroupIds = students
      .map((s) => s.classGroupId)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
    const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name")
      .lean<ClassGroupRow[]>();
    const classGroupMap = new Map(
      classGroups.map((cg) => [String(cg._id), cg.name || ""])
    );

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const periods = await AcademicPeriod.find({
      schoolId: context.schoolId,
      startDate: { $gte: twoYearsAgo },
    })
      .select("_id name label endDate")
      .sort({ startDate: -1 })
      .lean<AcademicPeriodRow[]>();

    const releasedCards = await listReleasedStudentReportCards({
      schoolId: context.schoolId,
      studentIds,
      academicPeriodIds: periods.map((period) => period._id),
    });

    const periodMap = new Map(periods.map((period) => [String(period._id), period]));

    const reports: AvailableReport[] = releasedCards
      .map((card) => {
        const studentId = String(card.studentId);
        const periodId = String(card.academicPeriodId);
        const student = students.find((row) => String(row._id) === studentId);
        if (!student) return null;

        const wardName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
        const classGroup = classGroupMap.get(String(student.classGroupId)) || "";
        const period = periodMap.get(periodId);
        const termSummary = card.termSummarySnapshot as
          | { averageFinalScore?: number }
          | undefined;

        return {
          id: `snapshot_${String(card._id)}`,
          type: "report_card" as const,
          title: `Report Card - ${period?.label || period?.name || wardName}`,
          wardId: studentId,
          wardName,
          periodId,
          periodLabel: period?.label || period?.name || "Academic Period",
          classGroup,
          status: "available" as const,
          generatedAt: card.releasedAt?.toISOString() || null,
          averageScore:
            typeof termSummary?.averageFinalScore === "number"
              ? termSummary.averageFinalScore
              : null,
          classPosition: null,
          studentReportCardId: String(card._id),
          source: "snapshot" as const,
        };
      })
      .filter((row): row is AvailableReport => row !== null);

    reports.sort((a, b) => {
      if (a.generatedAt && b.generatedAt) {
        return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
      }
      return 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        wards: students.map((s) => ({
          id: String(s._id),
          name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        })),
        reports: reports.slice(0, 50),
        periods: periods.map((p) => ({
          id: String(p._id),
          label: p.label || p.name,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Failed to fetch parent reports:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
