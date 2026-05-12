import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { ClassGroup } from "@/models/ClassGroup";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { resolveLessonNoteSchemeFields } from "@/lib/lesson-notes/validate-lesson-note-scheme";

function nextMonday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d;
}

function splitIndicators(value: string | null | undefined) {
  return (value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("schemeItemId");
    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return Response.json({ success: false, error: "schemeItemId is required" }, { status: 400 });
    }

    const item = (await SchemeItem.findOne({
      _id: new mongoose.Types.ObjectId(itemId),
      schoolId: context.schoolId,
    }).lean()) as ISchemeItem | null;
    if (!item) {
      return Response.json({ success: false, error: "Scheme row not found" }, { status: 404 });
    }

    const scheme = (await SchemeOfWork.findOne({
      _id: item.schemeId,
      schoolId: context.schoolId,
      status: { $in: ["approved", "active", "draft", "submitted", "needs_revision"] },
    }).lean()) as ISchemeOfWork | null;
    if (!scheme) {
      return Response.json({ success: false, error: "Scheme of Learning not found" }, { status: 404 });
    }

    let targetClassGroupId = scheme.classGroupId as mongoose.Types.ObjectId | null | undefined;
    if (!targetClassGroupId) {
      const candidateClassGroups = await ClassGroup.find({
        schoolId: context.schoolId,
        ...(scheme.gradeId ? { gradeId: scheme.gradeId } : {}),
      })
        .select("_id")
        .lean<{ _id: mongoose.Types.ObjectId }[]>();

      if (context.isAdmin) {
        targetClassGroupId = candidateClassGroups[0]?._id ?? null;
      } else {
        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          classGroupId: { $in: candidateClassGroups.map((group) => group._id) },
          ...(scheme.subjectId ? { subjectId: scheme.subjectId } : {}),
          status: "active",
        })
          .sort({ createdAt: 1 })
          .select("classGroupId")
          .lean<{ classGroupId: mongoose.Types.ObjectId }>();
        targetClassGroupId = assignment?.classGroupId ?? null;
      }
    }

    if (!targetClassGroupId) {
      return Response.json(
        { success: false, error: "No class group is available for this grade-level Scheme of Learning" },
        { status: 400 }
      );
    }

    const classGroup = await ClassGroup.findOne({
      _id: targetClassGroupId,
      schoolId: context.schoolId,
    }).select("_id gradeId name").lean();
    if (!classGroup) {
      return Response.json({ success: false, error: "Class not found" }, { status: 404 });
    }

    if (!context.isAdmin) {
      const assignment = await TeacherAssignment.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: targetClassGroupId,
        ...(scheme.subjectId ? { subjectId: scheme.subjectId } : {}),
        status: "active",
      }).select("_id").lean();
      if (!assignment) {
        return Response.json(
          { success: false, error: "You are not assigned to this class and subject" },
          { status: 403 }
        );
      }
    }

    const schemeResolution = await resolveLessonNoteSchemeFields({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      classGroupId: targetClassGroupId,
      subjectId: scheme.subjectId ?? null,
      schemeId: String(scheme._id),
      schemeItemIds: [String(item._id)],
    });
    if (!schemeResolution.ok) {
      return Response.json(
        { success: false, error: schemeResolution.error },
        { status: schemeResolution.status }
      );
    }

    const indicatorTexts = splitIndicators(item.indicator);
    const weekOf = item.plannedStartDate || item.plannedEndDate || nextMonday();
    const topic = item.title || item.topic || "Lesson from Scheme of Learning";
    const learningObjective = item.learningObjective || item.learningObjectives?.[0] || topic;

    return Response.json({
      success: true,
      data: {
        initialData: {
          classGroupId: String(targetClassGroupId),
          subjectId: scheme.subjectId ? String(scheme.subjectId) : undefined,
          templateType: "SIMPLE",
          weekOf: new Date(weekOf).toISOString(),
          date: item.plannedStartDate ? new Date(item.plannedStartDate).toISOString() : undefined,
          topic,
          durationMinutes: item.suggestedDurationMinutes ?? 40,
          references: uniqueStrings([item.contentStandard, ...indicatorTexts]),
          curriculum: {
            strand: item.strand || "",
            subStrand: item.subStrand || "",
            contentStandard: item.contentStandard || "",
            indicators: indicatorTexts.map((text) => ({ refNo: text, text })),
            learningOutcomes: uniqueStrings([learningObjective]),
          },
          tlms: uniqueStrings(item.teachingResources || []),
          body: {
            objectives: learningObjective,
            content: item.notes || item.contentStandard || topic,
          },
          assessment: {
            inClassChecks: item.assessmentIdeas || [],
            exitTicket: "",
            homework: "",
          },
          resources: [],
          tags: uniqueStrings(["scheme-of-learning", item.rowType || null]),
          status: "draft",
          schemeId: String(scheme._id),
          schemeItemIds: [String(item._id)],
        },
        scheme: {
          id: String(scheme._id),
          title: scheme.title,
          status: scheme.status,
        },
        item: {
          id: String(item._id),
          title,
          weekNumber: item.weekNumber ?? null,
        },
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Could not prepare lesson note" },
      { status: 500 }
    );
  }
}
