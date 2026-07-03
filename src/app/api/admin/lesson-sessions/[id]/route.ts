import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonWeekPlan } from "@/models/LessonWeekPlan";
import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";

function toObjectIdOrNull(id: string | null | undefined) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

function formatDateYmd(value?: Date | null) {
  if (!value) return null;
  return value.toISOString().split("T")[0];
}

function formatTeacherName(
  teacher:
    | {
        userId?: { firstName?: string; lastName?: string; name?: string; email?: string } | null;
        employeeId?: string | null;
      }
    | null
    | undefined,
) {
  const user = teacher?.userId;
  const name =
    user?.name ||
    `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() ||
    user?.email ||
    "Unknown teacher";
  return teacher?.employeeId ? `${name} (${teacher.employeeId})` : name;
}

function formatClassName(
  classGroup: { name?: string; gradeId?: { name?: string } | null } | null | undefined,
) {
  if (!classGroup) return "Unknown class";
  return `${classGroup.gradeId?.name ?? ""} ${classGroup.name ?? ""}`.trim() || "Unknown class";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const session = await LessonSession.findOne({
      _id: sessionId,
      schoolId: context.schoolId,
    })
      .select(
        "_id title schoolId weekPlanId lessonNoteId classGroupId subjectOfferingId ownerTeacherId sequenceInWeek scheduledDate dayOfWeek startTime endTime durationMinutes status studentVisibility parentVisibility adminVisibility learnTeacherPriority planNotes contentBlocks assessmentItems boardNotes contentVersion createdAt updatedAt",
      )
      .lean();

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const deliveries = await LessonDelivery.find({
      sessionId,
      schoolId: context.schoolId,
    })
      .select(
        "_id classGroupId scheduledTeacherId ownerTeacherId actualTeacherId substituteReason status scheduledDate dayOfWeek startTime endTime durationMinutes startedAt endedAt completedAt",
      )
      .sort({ scheduledDate: 1, startTime: 1 })
      .lean();

    const teacherIds = [
      session.ownerTeacherId,
      ...deliveries.flatMap((delivery) => [
        delivery.ownerTeacherId,
        delivery.scheduledTeacherId,
        delivery.actualTeacherId,
      ]),
    ].filter(Boolean);
    const classGroupIds = [
      session.classGroupId,
      ...deliveries.map((delivery) => delivery.classGroupId),
    ].filter(Boolean);

    const [teachers, classGroups, offering, weekPlan] = await Promise.all([
      Teacher.find({ _id: { $in: teacherIds }, schoolId: context.schoolId })
        .select("_id userId employeeId")
        .populate({ path: "userId", select: "firstName lastName name email" })
        .lean<
          Array<{
            _id: mongoose.Types.ObjectId;
            userId?: { firstName?: string; lastName?: string; name?: string; email?: string } | null;
            employeeId?: string | null;
          }>
        >(),
      ClassGroup.find({ _id: { $in: classGroupIds }, schoolId: context.schoolId })
        .select("_id name gradeId")
        .populate({ path: "gradeId", select: "name" })
        .lean<
          Array<{
            _id: mongoose.Types.ObjectId;
            name?: string;
            gradeId?: { name?: string } | null;
          }>
        >(),
      SubjectOffering.findOne({
        _id: session.subjectOfferingId,
        schoolId: context.schoolId,
      })
        .select("_id displayName shortName code subjectId gradeBand stage")
        .populate({ path: "subjectId", select: "name" })
        .lean<{
          _id: mongoose.Types.ObjectId;
          displayName?: string | null;
          shortName?: string | null;
          code?: string | null;
          gradeBand?: string | null;
          stage?: string | null;
          subjectId?: { name?: string } | null;
        } | null>(),
      LessonWeekPlan.findOne({
        _id: session.weekPlanId,
        schoolId: context.schoolId,
      })
        .select("_id title weekLabel weekStartDate weekEndDate status")
        .lean<{
          _id: mongoose.Types.ObjectId;
          title?: string;
          weekLabel?: string;
          weekStartDate?: Date;
          weekEndDate?: Date;
          status?: string;
        } | null>(),
    ]);

    const teacherMap = new Map(teachers.map((teacher) => [String(teacher._id), teacher]));
    const classMap = new Map(classGroups.map((classGroup) => [String(classGroup._id), classGroup]));
    const sessionClass = classMap.get(String(session.classGroupId));
    const subjectName =
      offering?.shortName ||
      offering?.displayName ||
      offering?.subjectId?.name ||
      "Unknown subject";

    return Response.json({
      success: true,
      data: {
        session: {
          id: String(session._id),
          title: session.title,
          status: session.status,
          scheduledDate: formatDateYmd(session.scheduledDate),
          dayOfWeek: session.dayOfWeek,
          startTime: session.startTime,
          endTime: session.endTime,
          durationMinutes: session.durationMinutes,
          sequenceInWeek: session.sequenceInWeek,
          teacher: {
            id: String(session.ownerTeacherId),
            name: formatTeacherName(teacherMap.get(String(session.ownerTeacherId))),
          },
          classGroup: {
            id: String(session.classGroupId),
            name: formatClassName(sessionClass),
          },
          subject: {
            id: String(session.subjectOfferingId),
            name: subjectName,
            code: offering?.code ?? null,
            gradeBand: offering?.gradeBand ?? null,
            stage: offering?.stage ?? null,
          },
          weekPlan: weekPlan
            ? {
                id: String(weekPlan._id),
                title: weekPlan.title ?? "Week plan",
                weekLabel: weekPlan.weekLabel ?? "",
                weekStartDate: formatDateYmd(weekPlan.weekStartDate),
                weekEndDate: formatDateYmd(weekPlan.weekEndDate),
                status: weekPlan.status ?? null,
              }
            : null,
          visibility: {
            student: session.studentVisibility,
            parent: Boolean(session.parentVisibility),
            admin: Boolean(session.adminVisibility),
            learnTeacherPriority: Boolean(session.learnTeacherPriority),
          },
          counts: {
            contentBlocks: session.contentBlocks?.length ?? 0,
            assessmentItems: session.assessmentItems?.length ?? 0,
            boardNotes: session.boardNotes?.contentHtml ? 1 : 0,
          },
          planNotes: session.planNotes?.trim() || null,
          contentBlocks: (session.contentBlocks ?? [])
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((block) => ({
              id: block.id,
              type: block.type,
              title: block.title || block.type,
              estimatedMinutes: block.estimatedMinutes ?? null,
              aiGenerated: Boolean(block.aiGenerated),
              teacherReviewed: Boolean(block.teacherReviewed),
            })),
          assessmentItems: (session.assessmentItems ?? []).map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title || item.type,
            estimatedMinutes: item.estimatedMinutes ?? null,
            aiGenerated: Boolean(item.aiGenerated),
          })),
          createdAt: session.createdAt?.toISOString() ?? null,
          updatedAt: session.updatedAt?.toISOString() ?? null,
        },
        deliveries: deliveries.map((delivery) => ({
          id: String(delivery._id),
          classGroup: {
            id: String(delivery.classGroupId),
            name: formatClassName(classMap.get(String(delivery.classGroupId))),
          },
          status: delivery.status,
          scheduledDate: formatDateYmd(delivery.scheduledDate ?? session.scheduledDate),
          dayOfWeek: delivery.dayOfWeek ?? session.dayOfWeek,
          startTime: delivery.startTime ?? session.startTime,
          endTime: delivery.endTime ?? session.endTime,
          durationMinutes: delivery.durationMinutes ?? session.durationMinutes,
          scheduledTeacher: {
            id: String(delivery.scheduledTeacherId),
            name: formatTeacherName(teacherMap.get(String(delivery.scheduledTeacherId))),
          },
          actualTeacher: delivery.actualTeacherId
            ? {
                id: String(delivery.actualTeacherId),
                name: formatTeacherName(teacherMap.get(String(delivery.actualTeacherId))),
              }
            : null,
          substituteReason: delivery.substituteReason ?? null,
          startedAt: delivery.startedAt?.toISOString() ?? null,
          endedAt: delivery.endedAt?.toISOString() ?? null,
          completedAt: delivery.completedAt?.toISOString() ?? null,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[admin/lesson-sessions/[id] GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load session";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
