import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Assessment } from "@/models/Assessment";
import { ClassGroup } from "@/models/ClassGroup";
import { GradingScale } from "@/models/GradingScale";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { SubjectGrade } from "@/models/SubjectGrade";
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

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ classGroupId: string; subjectId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookPublish)) {
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

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    if (!period) {
      return Response.json(
        { success: false, error: "No active academic period" },
        { status: 400 }
      );
    }

    const [classGroup, subject] = await Promise.all([
      ClassGroup.findOne({ _id: classGroupObjId, schoolId: context.schoolId })
        .select("_id")
        .lean(),
      Subject.findOne({ _id: subjectObjId, schoolId: context.schoolId })
        .select("_id")
        .lean(),
    ]);

    if (!classGroup || !subject) {
      return Response.json(
        { success: false, error: "Class group or subject not found" },
        { status: 404 }
      );
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

    const students = await Student.find({
      schoolId: context.schoolId,
      classGroupId: classGroupObjId,
      status: "active",
    })
      .select("_id")
      .lean();

    if (students.length === 0) {
      return Response.json({ success: true, data: { published: 0 } });
    }

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
      .select("studentId assessmentType title maxScore score weight teacherId")
      .lean();

    if (assessments.length === 0) {
      return Response.json(
        { success: false, error: "No assessments to publish" },
        { status: 400 }
      );
    }

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

    const definitions = Array.from(definitionMap.values());

    const now = new Date();
    const gradeOps: Array<{
      updateOne: {
        filter: Record<string, unknown>;
        update: Record<string, unknown>;
        upsert: boolean;
      };
    }> = [];

    students.forEach((student) => {
      const studentMap = byStudent.get(String(student._id));
      if (!studentMap) return;

      let caTotal = 0;
      let caMaxTotal = 0;
      let examScore = 0;
      let examMaxScore = 0;

      definitions.forEach((definition) => {
        const entry = studentMap.get(definition.id);
        const score = entry?.score ?? null;

        if (score !== null) {
          if (CA_TYPES.has(definition.type)) {
            caTotal += score;
            caMaxTotal += definition.maxScore;
          } else if (EXAM_TYPES.has(definition.type)) {
            examScore += score;
            examMaxScore += definition.maxScore;
          } else {
            caTotal += score;
            caMaxTotal += definition.maxScore;
          }
        } else {
          if (CA_TYPES.has(definition.type)) caMaxTotal += definition.maxScore;
          if (EXAM_TYPES.has(definition.type)) examMaxScore += definition.maxScore;
        }
      });

      const caPercentage = caMaxTotal > 0 ? (caTotal / caMaxTotal) * 100 : 0;
      const examPercentage = examMaxScore > 0 ? (examScore / examMaxScore) * 100 : 0;
      const totalScore = caPercentage * caWeight + examPercentage * examWeight;
      const mapping = getGradeMapping(mappings, totalScore);

      const gradeLetter = mapping?.letter ?? "";
      const gradePoint = mapping?.point ?? 0;
      const isPassed = totalScore >= 50;
      const teacherId = studentMap.values().next().value?.teacherId ?? context.teacherId;

      gradeOps.push({
        updateOne: {
          filter: {
            schoolId: context.schoolId,
            academicPeriodId: period._id,
            subjectId: subjectObjId,
            studentId: student._id,
          },
          update: {
            $set: {
              caTotal: Number(caTotal.toFixed(2)),
              caMaxTotal: Number(caMaxTotal.toFixed(2)),
              caPercentage: Number(caPercentage.toFixed(2)),
              examScore: Number(examScore.toFixed(2)),
              examMaxScore: Number(examMaxScore.toFixed(2)),
              examPercentage: Number(examPercentage.toFixed(2)),
              totalScore: Number(totalScore.toFixed(2)),
              gradeLetter,
              gradePoint,
              isPassed,
              teacherId,
              lastUpdated: now,
            },
            $setOnInsert: {
              schoolId: context.schoolId,
              academicPeriodId: period._id,
              subjectId: subjectObjId,
              studentId: student._id,
              teacherId,
            },
          },
          upsert: true,
        },
      });
    });

    if (gradeOps.length > 0) {
      await SubjectGrade.bulkWrite(gradeOps, { ordered: false });
    }

    await Assessment.updateMany(
      { ...assessmentQuery, gradedAt: null },
      { $set: { gradedAt: now } }
    );

    return Response.json({
      success: true,
      data: {
        published: gradeOps.length,
        totalAssessments: assessments.length,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to publish gradebook:", e);
    const message = e instanceof Error ? e.message : "Failed to publish gradebook";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
