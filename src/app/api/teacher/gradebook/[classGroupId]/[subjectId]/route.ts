import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Assessment } from "@/models/Assessment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { GradingScale } from "@/models/GradingScale";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const CA_TYPES = new Set(["ca", "quiz", "assignment", "midterm", "project"]);
const EXAM_TYPES = new Set(["exam", "mock"]);

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function buildAssessmentKey(input: {
  assessmentType: string;
  title: string;
  maxScore: number;
  weight: number;
}) {
  return `${input.assessmentType}::${input.title}::${input.maxScore}::${input.weight}`;
}

function getGradeMapping(
  mappings: Array<{ minPercentage: number; maxPercentage: number; letter: string; point: number }>,
  percentage: number
) {
  return mappings.find(
    (mapping) => percentage >= mapping.minPercentage && percentage <= mapping.maxPercentage
  );
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ classGroupId: string; subjectId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { classGroupId, subjectId } = await ctx.params;
    const classGroupObjId = toObjectIdOrNull(classGroupId);
    const subjectObjId = toObjectIdOrNull(subjectId);

    if (!classGroupObjId || !subjectObjId) {
      return Response.json(
        { success: false, error: "Invalid class group or subject" },
        { status: 400 }
      );
    }

    const [classGroup, subject, period] = await Promise.all([
      ClassGroup.findOne({ _id: classGroupObjId, schoolId: context.schoolId })
        .select("_id name gradeId")
        .lean(),
      Subject.findOne({ _id: subjectObjId, schoolId: context.schoolId })
        .select("_id name")
        .lean(),
      AcademicPeriod.findOne({ schoolId: context.schoolId, isCurrent: true })
        .select("_id")
        .lean(),
    ]);

    if (!classGroup || !subject) {
      return Response.json(
        { success: false, error: "Class group or subject not found" },
        { status: 404 }
      );
    }

    if (!period) {
      return Response.json({
        success: true,
        data: {
          classGroup: { _id: String(classGroup._id), name: classGroup.name },
          subject: { _id: String(subject._id), name: subject.name },
          assessmentScheme: { categories: [] },
          students: [],
        },
      });
    }

    if (!context.isAdmin) {
      const assignment = await TeacherAssignment.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        subjectId: subjectObjId,
        academicPeriodId: period._id,
        status: "active",
      })
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    const grade = classGroup.gradeId
      ? await Grade.findById(classGroup.gradeId).select("name").lean()
      : null;

    const classLabel = grade
      ? `${grade.name} ${classGroup.name}`.trim()
      : classGroup.name;

    const students = await Student.find({
      schoolId: context.schoolId,
      classGroupId: classGroupObjId,
      status: "active",
    })
      .select("_id firstName lastName middleName admissionNo")
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const studentIds = students.map((student) => student._id);

    const assessmentQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      academicPeriodId: period._id,
      subjectId: subjectObjId,
      studentId: { $in: studentIds },
    };

    if (!context.isAdmin) {
      assessmentQuery.teacherId = context.teacherId;
    }

    const assessments = await Assessment.find(assessmentQuery)
      .select("studentId assessmentType title maxScore score weight gradedAt")
      .lean();

    const gradingScale = await GradingScale.findOne({
      schoolId: context.schoolId,
      isDefault: true,
    })
      .select("caWeight examWeight gradeMappings")
      .lean();

    const caWeight = gradingScale?.caWeight ?? 0.3;
    const examWeight = gradingScale?.examWeight ?? 0.7;
    const mappings = gradingScale?.gradeMappings || [];

    const definitionMap = new Map<
      string,
      { id: string; title: string; maxScore: number; type: string; weight: number }
    >();

    const byStudent = new Map<string, Map<string, typeof assessments[number]>>();

    for (const assessment of assessments) {
      const weight = assessment.weight ?? 1;
      const key = buildAssessmentKey({
        assessmentType: assessment.assessmentType,
        title: assessment.title,
        maxScore: assessment.maxScore,
        weight,
      });

      if (!definitionMap.has(key)) {
        definitionMap.set(key, {
          id: key,
          title: assessment.title,
          maxScore: assessment.maxScore,
          type: assessment.assessmentType,
          weight,
        });
      }

      const studentKey = String(assessment.studentId);
      if (!byStudent.has(studentKey)) {
        byStudent.set(studentKey, new Map());
      }
      byStudent.get(studentKey)?.set(key, assessment);
    }

    const definitions = Array.from(definitionMap.values()).sort((a, b) =>
      a.title.localeCompare(b.title)
    );

    const categories = [
      {
        name: "CA",
        weight: caWeight,
        assessments: definitions.filter((def) => CA_TYPES.has(def.type)),
      },
      {
        name: "Exam",
        weight: examWeight,
        assessments: definitions.filter((def) => EXAM_TYPES.has(def.type)),
      },
    ].filter((category) => category.assessments.length > 0);

    const studentsData = students.map((student) => {
      const studentMap = byStudent.get(String(student._id));
      const scores: Record<
        string,
        { score: number | null; status: "draft" | "published" }
      > = {};

      let caTotal = 0;
      let caMax = 0;
      let examTotal = 0;
      let examMax = 0;

      for (const def of definitions) {
        const record = studentMap?.get(def.id);
        const score = record?.score ?? null;
        const status = record?.gradedAt ? "published" : "draft";

        scores[def.id] = { score, status };

        if (score !== null) {
          if (CA_TYPES.has(def.type)) {
            caTotal += score;
            caMax += def.maxScore;
          } else if (EXAM_TYPES.has(def.type)) {
            examTotal += score;
            examMax += def.maxScore;
          }
        } else {
          if (CA_TYPES.has(def.type)) caMax += def.maxScore;
          if (EXAM_TYPES.has(def.type)) examMax += def.maxScore;
        }
      }

      const caPercentage = caMax > 0 ? (caTotal / caMax) * 100 : 0;
      const examPercentage = examMax > 0 ? (examTotal / examMax) * 100 : 0;
      const finalScore = caPercentage * caWeight + examPercentage * examWeight;
      const mapping = getGradeMapping(mappings, finalScore);

      return {
        _id: String(student._id),
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo || undefined,
        scores,
        totals: {
          caTotal: Number(caTotal.toFixed(2)),
          examTotal: Number(examTotal.toFixed(2)),
          finalScore: Number(finalScore.toFixed(2)),
          grade: mapping?.letter || "",
        },
      };
    });

    return Response.json({
      success: true,
      data: {
        classGroup: { _id: String(classGroup._id), name: classLabel },
        subject: { _id: String(subject._id), name: subject.name },
        assessmentScheme: { categories },
        students: studentsData,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load gradebook:", e);
    const message = e instanceof Error ? e.message : "Failed to load gradebook";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
