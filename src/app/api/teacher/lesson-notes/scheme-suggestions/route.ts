import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { SchemeOfWork, type ISchemeOfWork } from "@/models/SchemeOfWork";
import { SchemeItem, type ISchemeItem } from "@/models/SchemeItem";
import { SchoolSettings } from "@/models/SchoolSettings";
import { loadCurrentSchemeWeekForSchool } from "@/lib/schemes/load-current-scheme-week";
import { schemeItemOverlapsCalendarWeek } from "@/lib/schemes/resolve-scheme-week";
import { serializeSchemeItemRow, serializeSchemeRow } from "@/lib/schemes/serializers";
import {
  resolveLessonNoteSchemeFields,
} from "@/lib/lesson-notes/validate-lesson-note-scheme";

function schemeMatchesClassAndSubject(
  scheme: Pick<ISchemeOfWork, "gradeId" | "subjectId">,
  classGradeId: mongoose.Types.ObjectId | null | undefined,
  noteSubjectId: mongoose.Types.ObjectId | null | undefined
): boolean {
  const gid = scheme.gradeId;
  const sid = scheme.subjectId;
  if (gid && String(gid) !== String(classGradeId ?? "")) return false;
  if (sid && String(sid) !== String(noteSubjectId ?? "")) return false;
  return true;
}

function teacherMayListScheme(scheme: ISchemeOfWork, teacherId: mongoose.Types.ObjectId): boolean {
  const status = scheme.status;
  if (status === "active" || status === "approved") return true;
  if (status === "draft" || status === "submitted" || status === "needs_revision") {
    return scheme.ownerTeacherId ? String(scheme.ownerTeacherId) === String(teacherId) : false;
  }
  return false;
}

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const classGroupIdParam = searchParams.get("classGroupId");
    const subjectIdParam = searchParams.get("subjectId");
    const topic = (searchParams.get("topic") || "").trim().toLowerCase();
    const selectedSchemeId = searchParams.get("schemeId");

    if (!classGroupIdParam || !mongoose.Types.ObjectId.isValid(classGroupIdParam)) {
      return Response.json({ success: false, error: "classGroupId is required" }, { status: 400 });
    }

    const classGroupOid = new mongoose.Types.ObjectId(classGroupIdParam);
    let subjectOid: mongoose.Types.ObjectId | null = null;
    if (subjectIdParam) {
      if (!mongoose.Types.ObjectId.isValid(subjectIdParam)) {
        return Response.json({ success: false, error: "Invalid subjectId" }, { status: 400 });
      }
      subjectOid = new mongoose.Types.ObjectId(subjectIdParam);
    }

    const [settings, classGroup] = await Promise.all([
      SchoolSettings.findOne({ schoolId: context.schoolId }).select("academicPlanning").lean(),
      ClassGroup.findOne({ _id: classGroupOid, schoolId: context.schoolId }).select("gradeId").lean(),
    ]);

    if (!classGroup) {
      return Response.json({ success: false, error: "Class not found" }, { status: 404 });
    }

    const gradeId = classGroup.gradeId as mongoose.Types.ObjectId | undefined;

    const enabled = settings?.academicPlanning?.enableSchemeOfWork ?? false;
    if (!enabled) {
      return Response.json({
        success: true,
        data: {
          enabled: false,
          schemes: [],
          items: [],
          suggestedItems: [],
          selectedSchemeValid: null as boolean | null,
        },
      });
    }

    const schemes = (await SchemeOfWork.find({
      schoolId: context.schoolId,
      status: { $nin: ["archived"] },
    })
      .sort({ updatedAt: -1 })
      .limit(120)
      .lean()) as ISchemeOfWork[];

    const visible = schemes.filter(
      (s) =>
        teacherMayListScheme(s, context.teacherId) &&
        schemeMatchesClassAndSubject(s, gradeId ?? null, subjectOid)
    );

    let selectedSchemeValid: boolean | null = null;
    if (selectedSchemeId && mongoose.Types.ObjectId.isValid(selectedSchemeId)) {
      const resolved = await resolveLessonNoteSchemeFields({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupOid,
        subjectId: subjectOid,
        schemeId: selectedSchemeId,
        schemeItemIds: [],
      });
      selectedSchemeValid = resolved.ok;
    }

    const schemeIds = visible.map((s) => s._id);
    const items =
      schemeIds.length > 0
        ? ((await SchemeItem.find({
            schoolId: context.schoolId,
            schemeId: { $in: schemeIds },
          })
            .sort({ weekNumber: 1, sequence: 1, createdAt: 1 })
            .limit(400)
            .lean()) as ISchemeItem[])
        : [];

    const [currentSchemeWeek, currentPeriod] = await Promise.all([
      loadCurrentSchemeWeekForSchool(context.schoolId),
      AcademicPeriod.findOne({ schoolId: context.schoolId, isCurrent: true })
        .select("startDate endDate")
        .lean<{ startDate: Date; endDate: Date } | null>(),
    ]);

    const periodInput = currentPeriod
      ? { startDate: currentPeriod.startDate, endDate: currentPeriod.endDate }
      : null;
    const currentWeekStart =
      currentSchemeWeek.weekStartDate != null
        ? new Date(`${currentSchemeWeek.weekStartDate}T00:00:00.000Z`)
        : null;
    const currentWeekEnd =
      currentSchemeWeek.weekEndDate != null
        ? new Date(`${currentSchemeWeek.weekEndDate}T00:00:00.000Z`)
        : null;

    const currentWeekItems =
      periodInput && currentWeekStart && currentWeekEnd
        ? items.filter((it) =>
            schemeItemOverlapsCalendarWeek(it, periodInput, currentWeekStart, currentWeekEnd)
          )
        : [];

    const suggestedItems =
      topic.length > 0
        ? items
            .filter((it) => {
              const haystack = [
                it.title,
                it.topic,
                it.subtopic,
                it.strand,
                it.subStrand,
                it.contentStandard,
                it.indicator,
                ...(it.learningObjectives ?? []),
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return topic.split(/\s+/).every((word) => haystack.includes(word));
            })
            .slice(0, 12)
        : currentWeekItems.length > 0
          ? currentWeekItems.slice(0, 12)
          : items.slice(0, 12);

    return Response.json({
      success: true,
      data: {
        enabled: true,
        requireSchemeLinkForLessonNotes:
          settings?.academicPlanning?.requireSchemeLinkForLessonNotes ?? false,
        schemes: visible.map((s) => serializeSchemeRow(s)),
        items: items.map((it) => serializeSchemeItemRow(it)),
        suggestedItems: suggestedItems.map((it) => serializeSchemeItemRow(it)),
        currentWeekSuggestedItems: currentWeekItems.slice(0, 12).map((it) => serializeSchemeItemRow(it)),
        currentSchemeWeek,
        selectedSchemeValid,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("scheme-suggestions:", e);
    return Response.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load suggestions" },
      { status: 500 }
    );
  }
}
