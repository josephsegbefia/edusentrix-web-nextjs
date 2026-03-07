import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, type ISchool } from "@/models/School";
import { Student } from "@/models/Student";
import { SubjectGrade } from "@/models/SubjectGrade";
import { TermResult } from "@/models/TermResult";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Subject } from "@/models/Subject";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { GradingScale } from "@/models/GradingScale";
import { ReportTemplate } from "@/models/ReportTemplate";
import { getCurriculumProfile } from "@/constants/curriculum-profiles";
import { getReportTemplatePreset } from "@/constants/curriculum-report-templates";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const studentId = sp.get("studentId");
    const academicPeriodId = sp.get("academicPeriodId");

    if (!studentId || !academicPeriodId) {
      return NextResponse.json(
        { error: "studentId and academicPeriodId are required" },
        { status: 400 }
      );
    }

    const [school, student, period] = await Promise.all([
      School.findById(schoolId).lean() as Promise<ISchool | null>,
      Student.findOne({ _id: studentId, schoolId }).lean(),
      AcademicPeriod.findOne({ _id: academicPeriodId, schoolId }).lean(),
    ]);

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (!period) {
      return NextResponse.json({ error: "Academic period not found" }, { status: 404 });
    }

    const curriculumCode = school.curriculumCode || "ghana_nacca";
    const curriculumProfile = getCurriculumProfile(curriculumCode);

    const [
      subjectGrades,
      termResultRaw,
      grade,
      classGroup,
      gradingScale,
      reportTemplate,
    ] = await Promise.all([
      SubjectGrade.find({
        schoolId,
        studentId,
        academicPeriodId,
      })
        .populate("subjectId", "name code category")
        .lean(),
      TermResult.findOne({
        schoolId,
        studentId,
        academicPeriodId,
      }).lean(),
      Grade.findById((student as any).gradeId).lean(),
      ClassGroup.findById((student as any).classGroupId).lean(),
      GradingScale.findOne({ schoolId, isDefault: true }).lean(),
      ReportTemplate.findOne({ schoolId, isDefault: true }).lean(),
    ]);
    const termResult = Array.isArray(termResultRaw)
      ? termResultRaw[0] || null
      : termResultRaw;

    const templatePreset = getReportTemplatePreset(curriculumCode);

    const subjects = await Subject.find({ schoolId, isActive: true })
      .select("name code category")
      .lean();

    const subjectMap = new Map(
      subjects.map((s) => [String(s._id), s])
    );

    const gradeRows = subjectGrades.map((sg: any) => {
      const sub = subjectMap.get(String(sg.subjectId?._id || sg.subjectId));
      return {
        subjectName: sub?.name || sg.subjectId?.name || "Unknown",
        subjectCode: sub?.code || sg.subjectId?.code || "",
        category: (sub as any)?.category || null,
        caTotal: sg.caTotal,
        caMaxTotal: sg.caMaxTotal,
        caPercentage: sg.caPercentage,
        examScore: sg.examScore,
        examMaxScore: sg.examMaxScore,
        examPercentage: sg.examPercentage,
        totalScore: sg.totalScore,
        gradeLetter: sg.gradeLetter,
        gradePoint: sg.gradePoint,
        isPassed: sg.isPassed,
        components: sg.components || [],
        descriptorLevel: sg.descriptorLevel || null,
      };
    });

    const report = {
      school: {
        name: school.name,
        logo: school.logo,
        address: school.address,
        city: school.city,
        region: school.region,
      },
      student: {
        firstName: (student as any).firstName,
        lastName: (student as any).lastName,
        admissionNumber: (student as any).admissionNumber,
        gesIndexNumber: (student as any).gesIndexNumber,
      },
      grade: grade
        ? { name: (grade as any).name, stage: (grade as any).stage }
        : null,
      classGroup: classGroup ? { name: (classGroup as any).name } : null,
      period: {
        yearLabel: period.yearLabel,
        term: period.term,
      },
      curriculum: {
        code: curriculumCode,
        label: curriculumProfile.label,
        assessmentModel: curriculumProfile.assessmentModel,
        gradingSystem: curriculumProfile.gradingSystem,
      },
      subjects: gradeRows,
      summary: termResult
        ? {
            totalSubjects: termResult.totalSubjects,
            totalScore: termResult.totalScore,
            averageScore: termResult.averageScore,
            classPosition: termResult.classPosition,
            totalStudents: termResult.totalStudents,
            performanceTier: termResult.performanceTier,
            gpa: termResult.gpa,
            isPromoted: termResult.isPromoted,
          }
        : null,
      gradingScale: gradingScale
        ? {
            name: gradingScale.name,
            mappings: gradingScale.gradeMappings,
            caWeight: gradingScale.caWeight,
            examWeight: gradingScale.examWeight,
          }
        : null,
      template: reportTemplate
        ? {
            name: reportTemplate.name,
            sections: reportTemplate.sections,
            showClassPosition: reportTemplate.showClassPosition,
            showAttendance: reportTemplate.showAttendance,
            showConduct: reportTemplate.showConduct,
            showGradingKey: reportTemplate.showGradingKey,
            orientation: reportTemplate.orientation,
            paperSize: reportTemplate.paperSize,
          }
        : {
            name: templatePreset.name,
            sections: templatePreset.sections,
            showClassPosition: templatePreset.showClassPosition,
            showAttendance: templatePreset.showAttendance,
            showConduct: templatePreset.showConduct,
            showGradingKey: templatePreset.showGradingKey,
            orientation: templatePreset.orientation,
            paperSize: "A4" as const,
          },
    };

    return NextResponse.json({ success: true, data: report });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to generate report card data:", e);
    const message =
      e instanceof Error ? e.message : "Failed to generate report card";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
