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
import { resolveLessonNoteSubjectOffering } from "@/lib/lesson-notes/resolve-note-subject-offering";
import { getGhanaTodayDate, getMondayForGhanaWeek, parseGhanaDateLabel } from "@/lib/time/ghana";
import type { LessonNoteTemplateType } from "@/types/lesson-notes";

/**
 * Detect NaCCA/GES-style scheme rows (Ghana national curriculum import).
 * A row is NaCCA-style when it has an indicator list or a content standard code
 * that follows the Ghana curriculum format (e.g. B8.1.2.1, B5.3.4.2).
 */
function isNaCCAStyleRow(item: ISchemeItem): boolean {
  if (item.indicator && item.indicator.trim().length > 0) return true;
  const cs = item.contentStandard?.trim() ?? "";
  return /^B\d+\.\d+\.\d+(\.\d+)?/.test(cs);
}

/**
 * Choose the best lesson note template for this scheme row.
 * NaCCA-style rows get the NaCCA 3-phase template; everything else gets SIMPLE.
 */
function templateTypeForRow(item: ISchemeItem): LessonNoteTemplateType {
  return isNaCCAStyleRow(item) ? "NACCA_3_PHASE" : "SIMPLE";
}

/**
 * Build the lesson note body for the chosen template.
 * For NaCCA: starter/main/plenary with TLA in teacherActivities.
 * For SIMPLE: plain content string.
 */
function buildBodyForTemplate(
  templateType: LessonNoteTemplateType,
  item: ISchemeItem,
  fallbackContent: string,
): Record<string, unknown> {
  if (templateType === "NACCA_3_PHASE") {
    return {
      starter: {
        activities: "",
        rpkPrompt: "",
        engagementHook: "",
        timeMins: 10,
      },
      main: {
        teacherActivities: item.teachingLearningActivities?.trim() ?? "",
        learnerActivities: "",
        resourcesUsed: (item.teachingResources ?? []).join("; "),
        embeddedAssessment: (item.assessmentIdeas ?? []).join("; "),
        differentiation: "",
        groupingStrategy: "",
        timeMins: 25,
      },
      plenary: {
        summaryPoints: "",
        classworkAssignment: "",
        homework: (item.assessmentIdeas?.[0] ?? ""),
        timeMins: 5,
      },
    };
  }
  return { objectives: fallbackContent, content: fallbackContent };
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
          ...(scheme.subjectOfferingId
            ? { subjectOfferingId: scheme.subjectOfferingId }
            : scheme.subjectId
              ? { subjectId: scheme.subjectId }
              : {}),
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
        ...(scheme.subjectOfferingId
          ? { subjectOfferingId: scheme.subjectOfferingId }
          : scheme.subjectId
            ? { subjectId: scheme.subjectId }
            : {}),
        status: "active",
      }).select("_id").lean();
      if (!assignment) {
        return Response.json(
          { success: false, error: "You are not assigned to this class and subject" },
          { status: 403 }
        );
      }
    }

    const subjectOfferingResolution = await resolveLessonNoteSubjectOffering({
      schoolId: context.schoolId,
      classGroupId: targetClassGroupId,
      subjectOfferingId: scheme.subjectOfferingId ? String(scheme.subjectOfferingId) : null,
      subjectId: scheme.subjectId ? String(scheme.subjectId) : null,
    });
    if (!subjectOfferingResolution.ok) {
      return Response.json(
        { success: false, error: subjectOfferingResolution.error },
        { status: subjectOfferingResolution.status }
      );
    }
    const resolvedSubjectOfferingId = subjectOfferingResolution.subjectOfferingId;

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
    const weekEndingDate =
      item.plannedEndDate || parseGhanaDateLabel(item.weekEndingLabel) || null;
    const weekOf =
      item.plannedStartDate ||
      (weekEndingDate ? getMondayForGhanaWeek(new Date(weekEndingDate)) : getGhanaTodayDate());
    const lessonDate = getGhanaTodayDate();
    const topic = item.title || item.topic || "Lesson from Scheme of Learning";

    // All learning objectives — use every entry, not just the first.
    const allObjectives = uniqueStrings([
      ...(item.learningObjectives ?? []),
      item.learningObjective ?? null,
    ]);
    const primaryObjective = allObjectives[0] || topic;

    // Detect template type from scheme row style.
    const templateType = templateTypeForRow(item);

    // Body content fallback for SIMPLE template.
    const bodyContent =
      item.teachingLearningActivities?.trim() ||
      item.notes?.trim() ||
      item.contentStandard?.trim() ||
      topic;

    const body = buildBodyForTemplate(templateType, item, bodyContent);

    return Response.json({
      success: true,
      data: {
        initialData: {
          classGroupId: String(targetClassGroupId),
          subjectOfferingId: String(resolvedSubjectOfferingId),
          subjectId: scheme.subjectId ? String(scheme.subjectId) : undefined,
          templateType,
          weekOf: new Date(weekOf).toISOString(),
          date: lessonDate.toISOString(),
          weekEndingDate: weekEndingDate ? new Date(weekEndingDate).toISOString() : undefined,
          topic,
          durationMinutes: item.suggestedDurationMinutes ?? 40,
          references: uniqueStrings([item.contentStandard, ...indicatorTexts]),
          curriculum: {
            strand: item.strand || "",
            subStrand: item.subStrand || "",
            contentStandard: item.contentStandard || "",
            indicators: indicatorTexts.map((text) => ({ refNo: text, text })),
            learningOutcomes: allObjectives,
          },
          tlms: uniqueStrings(item.teachingResources || []),
          body,
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
          weekEndingDate: weekEndingDate ? new Date(weekEndingDate).toISOString() : null,
          weekEndingLabel: item.weekEndingLabel ?? null,
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
