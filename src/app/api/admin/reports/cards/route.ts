import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildLegacyReportCardViewData } from "@/lib/academics/reporting/build-student-report-card-view";
import { resolveStudentReportCardViewData } from "@/lib/academics/reporting/resolve-student-report-card-view";
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
import { getReportTemplatePreset } from "@/constants/curriculum-report-templates";

function toObjectId(value: string) {
  return new mongoose.Types.ObjectId(value);
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("reports");
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const studentId = sp.get("studentId");
    const academicPeriodId = sp.get("academicPeriodId");

    if (!studentId || !academicPeriodId) {
      return NextResponse.json(
        { success: false, error: "studentId and academicPeriodId are required" },
        { status: 400 }
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(studentId) ||
      !mongoose.Types.ObjectId.isValid(academicPeriodId)
    ) {
      return NextResponse.json({ success: false, error: "Invalid identifiers" }, { status: 400 });
    }

    const schoolIdObj = toObjectId(String(schoolId));
    const studentIdObj = toObjectId(studentId);
    const academicPeriodIdObj = toObjectId(academicPeriodId);

    const snapshotView = await resolveStudentReportCardViewData({
      schoolId: schoolIdObj,
      studentId: studentIdObj,
      academicPeriodId: academicPeriodIdObj,
      statuses: ["released", "approved", "compiled"],
    });

    if (snapshotView) {
      return NextResponse.json({ success: true, data: snapshotView });
    }

    const [school, student, period] = await Promise.all([
      School.findById(schoolIdObj).lean() as Promise<ISchool | null>,
      Student.findOne({ _id: studentIdObj, schoolId: schoolIdObj }).lean(),
      AcademicPeriod.findOne({ _id: academicPeriodIdObj, schoolId: schoolIdObj }).lean(),
    ]);

    if (!school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }
    if (!student) {
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }
    if (!period) {
      return NextResponse.json({ success: false, error: "Academic period not found" }, { status: 404 });
    }

    const curriculumCode = school.curriculumCode || "ghana_nacca";

    const [
      subjectGrades,
      termResultRaw,
      grade,
      classGroup,
      gradingScale,
      reportTemplate,
    ] = await Promise.all([
      SubjectGrade.find({
        schoolId: schoolIdObj,
        studentId: studentIdObj,
        academicPeriodId: academicPeriodIdObj,
      })
        .populate("subjectId", "name code category")
        .lean(),
      TermResult.findOne({
        schoolId: schoolIdObj,
        studentId: studentIdObj,
        academicPeriodId: academicPeriodIdObj,
      }).lean(),
      Grade.findById((student as { gradeId?: mongoose.Types.ObjectId }).gradeId).lean(),
      ClassGroup.findById((student as { classGroupId?: mongoose.Types.ObjectId }).classGroupId).lean(),
      GradingScale.findOne({ schoolId: schoolIdObj, isDefault: true }).lean(),
      ReportTemplate.findOne({ schoolId: schoolIdObj, isDefault: true }).lean(),
    ]);

    const termResult = Array.isArray(termResultRaw) ? termResultRaw[0] || null : termResultRaw;
    const templatePreset = getReportTemplatePreset(curriculumCode);

    const subjects = await Subject.find({ schoolId: schoolIdObj, isActive: true })
      .select("name code category")
      .lean();

    const subjectMap = new Map(subjects.map((subject) => [String(subject._id), subject]));

    const gradeRows = subjectGrades.map((sg) => {
      const subjectRef = sg.subjectId as
        | { _id?: mongoose.Types.ObjectId; name?: string; code?: string; category?: string }
        | mongoose.Types.ObjectId
        | undefined;
      const subjectId =
        subjectRef && typeof subjectRef === "object" && "_id" in subjectRef
          ? String(subjectRef._id)
          : String(subjectRef);
      const sub = subjectMap.get(subjectId);
      const populatedSubject =
        subjectRef && typeof subjectRef === "object" && "name" in subjectRef ? subjectRef : null;

      return {
        subjectName: sub?.name || populatedSubject?.name || "Unknown",
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

    const legacyView = buildLegacyReportCardViewData({
      school: {
        name: school.name,
        logo: school.logo,
        address: school.address,
        city: school.city,
        region: school.region,
      },
      student: {
        firstName: (student as { firstName?: string }).firstName || "",
        lastName: (student as { lastName?: string }).lastName || "",
        admissionNumber: (student as { admissionNo?: string }).admissionNo,
      },
      grade: grade ? { name: grade.name } : null,
      classGroup: classGroup ? { name: classGroup.name } : null,
      period: {
        yearLabel: period.yearLabel,
        term: period.term,
      },
      subjects: gradeRows,
      summary: termResult
        ? {
            totalSubjects: termResult.totalSubjects,
            averageScore: termResult.averageScore,
            classPosition: termResult.classPosition,
            totalStudents: termResult.totalStudents,
          }
        : null,
      gradingScale: gradingScale
        ? {
            name: gradingScale.name,
            mappings: gradingScale.gradeMappings.map((mapping) => ({
              letter: mapping.letter,
              minPercentage: mapping.minPercentage,
              maxPercentage: mapping.maxPercentage,
              point: mapping.point,
              description: mapping.description ?? null,
            })),
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
            paperSize: "A4",
          },
    });

    return NextResponse.json({ success: true, data: legacyView });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Failed to generate report card data:", error);
    const message = error instanceof Error ? error.message : "Failed to generate report card";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
