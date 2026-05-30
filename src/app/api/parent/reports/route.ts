// src/app/api/parent/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { TermResult } from "@/models/TermResult";
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
  endDate?: Date;
};

type TermResultRow = {
  studentId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  averageScore?: number | null;
  classPosition?: number | null;
  calculatedAt?: Date;
};

interface AvailableReport {
  id: string;
  type: "term_report" | "progress_report" | "report_card";
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
  studentReportCardId?: string | null;
  source?: "snapshot" | "legacy";
}

export async function GET(req: NextRequest) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const wardId = searchParams.get("wardId");

    // Get all wards for this parent
    const guardians = await Guardian.find({ userId: context.userId })
      .select("studentId")
      .lean<GuardianLink[]>();

    if (!guardians.length) {
      return NextResponse.json({
        success: true,
        data: {
          wards: [],
          reports: [],
          periods: [],
        },
      });
    }

    let studentIds = guardians.map((g) => g.studentId);

    // Filter by specific ward if provided
    if (wardId && mongoose.Types.ObjectId.isValid(wardId)) {
      const wardObjectId = new mongoose.Types.ObjectId(wardId);
      if (studentIds.some((id) => id.equals(wardObjectId))) {
        studentIds = [wardObjectId];
      }
    }

    // Fetch students
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: context.schoolId,
    })
      .select("_id firstName lastName classGroupId")
      .lean<StudentRow[]>();

    // Get class groups
    const classGroupIds = students
      .map((s) => s.classGroupId)
      .filter((classGroupId): classGroupId is mongoose.Types.ObjectId => Boolean(classGroupId));
    const classGroups = await ClassGroup.find({ _id: { $in: classGroupIds } })
      .select("_id name")
      .lean<ClassGroupRow[]>();
    const classGroupMap = new Map(
      classGroups.map((cg) => [String(cg._id), cg.name || ""])
    );

    // Get available academic periods (last 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const periods = await AcademicPeriod.find({
      schoolId: context.schoolId,
      startDate: { $gte: twoYearsAgo },
    })
      .select("_id name label endDate")
      .sort({ startDate: -1 })
      .lean<AcademicPeriodRow[]>();

    // Get term results for these students
    const termResults = await TermResult.find({
      studentId: { $in: studentIds },
      schoolId: context.schoolId,
      academicPeriodId: { $in: periods.map((p) => p._id) },
    })
      .select("studentId academicPeriodId averageScore classPosition calculatedAt")
      .lean<TermResultRow[]>();

    // Build term result lookup
    const termResultLookup = new Map<string, TermResultRow>();
    termResults.forEach((tr) => {
      const key = `${String(tr.studentId)}_${String(tr.academicPeriodId)}`;
      termResultLookup.set(key, tr);
    });

    const releasedCards = await listReleasedStudentReportCards({
      schoolId: context.schoolId,
      studentIds,
      academicPeriodIds: periods.map((period) => period._id),
    });

    const periodMap = new Map(periods.map((period) => [String(period._id), period]));
    const releasedKeys = new Set<string>();

    const reports: AvailableReport[] = [];

    releasedCards.forEach((card) => {
      const studentId = String(card.studentId);
      const periodId = String(card.academicPeriodId);
      const key = `${studentId}_${periodId}`;
      releasedKeys.add(key);

      const student = students.find((row) => String(row._id) === studentId);
      if (!student) return;

      const wardName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
      const classGroup = classGroupMap.get(String(student.classGroupId)) || "";
      const period = periodMap.get(periodId);
      const termSummary = card.termSummarySnapshot as
        | { averageFinalScore?: number }
        | undefined;
      const studentSnapshot = card.studentSnapshot as { name?: string } | undefined;

      reports.push({
        id: `snapshot_${String(card._id)}`,
        type: "report_card",
        title: `Report Card - ${period?.label || period?.name || studentSnapshot?.name || wardName}`,
        wardId: studentId,
        wardName,
        periodId,
        periodLabel: period?.label || period?.name || "Academic Period",
        classGroup,
        status: "available",
        generatedAt: card.releasedAt?.toISOString() || null,
        averageScore:
          typeof termSummary?.averageFinalScore === "number"
            ? termSummary.averageFinalScore
            : null,
        classPosition: null,
        studentReportCardId: String(card._id),
        source: "snapshot",
      });
    });

    students.forEach((student) => {
      const studentId = String(student._id);
      const wardName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
      const classGroup = classGroupMap.get(String(student.classGroupId)) || "";

      periods.forEach((period) => {
        const key = `${studentId}_${String(period._id)}`;
        if (releasedKeys.has(key)) {
          return;
        }

        const termResult = termResultLookup.get(key);

        // Term Report Card
        reports.push({
          id: `report_${key}`,
          type: "term_report",
          title: `Term Report - ${period.label || period.name || "Academic Period"}`,
          wardId: studentId,
          wardName,
          periodId: String(period._id),
          periodLabel: period.label || period.name || "Academic Period",
          classGroup,
          status: termResult ? "available" : "not_available",
          generatedAt: termResult?.calculatedAt?.toISOString() || null,
          averageScore: termResult?.averageScore || null,
          classPosition: termResult?.classPosition || null,
          source: "legacy",
        });
      });
    });

    // Sort reports: available first, then by date
    reports.sort((a, b) => {
      if (a.status === "available" && b.status !== "available") return -1;
      if (a.status !== "available" && b.status === "available") return 1;
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
        reports: reports.slice(0, 50), // Limit to 50 most relevant
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
