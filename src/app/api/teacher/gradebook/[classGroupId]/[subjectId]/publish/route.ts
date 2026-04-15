import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildSchoolUserAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Assessment } from "@/models/Assessment";
import { ClassGroup } from "@/models/ClassGroup";
import { GradingScale, type IGradingScale } from "@/models/GradingScale";
import { School, type ISchool } from "@/models/School";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { SubjectGrade } from "@/models/SubjectGrade";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { getCurriculumProfile } from "@/constants/curriculum-profiles";
import { calculateGradeByStrategy } from "@/lib/academics/grading-strategies";

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
  req: NextRequest,
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

    const [gradingScaleDoc, school] = await Promise.all([
      GradingScale.findOne({
        schoolId: context.schoolId,
        isDefault: true,
      })
        .select("caWeight examWeight gradeMappings passThreshold")
        .lean(),
      School.findById(context.schoolId)
        .select("curriculumCode")
        .lean() as Promise<Pick<ISchool, "curriculumCode"> | null>,
    ]);

    const curriculumCode = school?.curriculumCode || "ghana_nacca";
    const profile = getCurriculumProfile(curriculumCode);

    const gradingScale: IGradingScale = {
      caWeight: gradingScaleDoc?.caWeight ?? profile.defaultCaWeight,
      examWeight: gradingScaleDoc?.examWeight ?? profile.defaultExamWeight,
      gradeMappings: gradingScaleDoc?.gradeMappings || [],
      passThreshold: (gradingScaleDoc as any)?.passThreshold ?? profile.passThreshold,
    } as IGradingScale;

    const byStudent = new Map<string, typeof assessments>();
    for (const assessment of assessments) {
      const key = String(assessment.studentId);
      if (!byStudent.has(key)) byStudent.set(key, []);
      byStudent.get(key)!.push(assessment);
    }

    const now = new Date();
    const gradeOps: Array<{
      updateOne: {
        filter: Record<string, unknown>;
        update: Record<string, unknown>;
        upsert: boolean;
      };
    }> = [];
    const afterRecords: Array<{
      studentId: string;
      totalScore: number;
      gradeLetter: string;
    }> = [];

    for (const student of students) {
      const studentAssessments = byStudent.get(String(student._id));
      if (!studentAssessments?.length) continue;

      const result = calculateGradeByStrategy(
        profile.assessmentModel,
        studentAssessments as any,
        gradingScale
      );

      const teacherId =
        studentAssessments[0]?.teacherId ?? context.teacherId;

      const totalScore = Number(result.totalScore.toFixed(2));

      const $set: Record<string, unknown> = {
        caTotal: Number(result.caTotal.toFixed(2)),
        caMaxTotal: Number(result.caMaxTotal.toFixed(2)),
        caPercentage: Number(result.caPercentage.toFixed(2)),
        examScore: Number(result.examScore.toFixed(2)),
        examMaxScore: Number(result.examMaxScore.toFixed(2)),
        examPercentage: Number(result.examPercentage.toFixed(2)),
        totalScore,
        gradeLetter: result.gradeLetter,
        gradePoint: result.gradePoint,
        isPassed: result.isPassed,
        teacherId,
        lastUpdated: now,
      };

      if (result.components) $set.components = result.components;
      if (result.descriptorLevel !== undefined)
        $set.descriptorLevel = result.descriptorLevel;

      afterRecords.push({
        studentId: String(student._id),
        totalScore,
        gradeLetter: result.gradeLetter,
      });

      gradeOps.push({
        updateOne: {
          filter: {
            schoolId: context.schoolId,
            academicPeriodId: period._id,
            subjectId: subjectObjId,
            studentId: student._id,
          },
          update: {
            $set,
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
    }

    if (gradeOps.length === 0) {
      return Response.json(
        { success: false, error: "No assessments to publish" },
        { status: 400 }
      );
    }

    const schoolIdStr = String(context.schoolId);
    const academicsStreamKey = `school:${schoolIdStr}:academics`;
    const auditContext = buildSchoolUserAuditContext(req, {
      userId: context.userId,
      schoolId: context.schoolId,
      actorRole: "teacher",
      idempotencyKey: resolveAuditIdempotencyKey(
        req,
        `grade.publish:${classGroupId}:${subjectId}:${String(period._id)}`
      ),
    });

    const publishStudentIds = afterRecords.map(
      (r) => new mongoose.Types.ObjectId(r.studentId)
    );

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const existingBefore = await SubjectGrade.find({
          schoolId: context.schoolId,
          academicPeriodId: period._id,
          subjectId: subjectObjId,
          studentId: { $in: publishStudentIds },
        })
          .session(session)
          .select("studentId totalScore gradeLetter")
          .lean();

        const beforeMap = new Map(
          existingBefore.map((r) => [
            String(r.studentId),
            { totalScore: r.totalScore, gradeLetter: r.gradeLetter },
          ])
        );

        await SubjectGrade.bulkWrite(gradeOps, { ordered: false, session });

        await Assessment.updateMany(
          { ...assessmentQuery, gradedAt: null },
          { $set: { gradedAt: now } },
          { session }
        );

        const beforeRecords = afterRecords.map((r) => {
          const prev = beforeMap.get(r.studentId);
          return {
            studentId: r.studentId,
            totalScore: prev?.totalScore ?? null,
            gradeLetter: prev?.gradeLetter ?? null,
          };
        });

        await writeTransactionalAuditEvent(session, {
          actionCode: "grade.published",
          scopeType: "school",
          scopeId: schoolIdStr,
          result: "succeeded",
          target: {
            targetEntityType: "ClassGroup",
            targetEntityId: classGroupObjId,
            secondaryEntityType: "Subject",
            secondaryEntityId: subjectObjId,
          },
          context: auditContext,
          payload: {
            before: {
              academicPeriodId: String(period._id),
              subjectId: String(subjectObjId),
              records: beforeRecords,
            },
            after: {
              academicPeriodId: String(period._id),
              subjectId: String(subjectObjId),
              records: afterRecords,
            },
          },
          streamKey: academicsStreamKey,
        });
      });
    } finally {
      await session.endSession();
    }

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
