import "server-only";
import mongoose, { type Types } from "mongoose";
import type {
  LeoActionCategory,
  LeoActionExecuteDTO,
  LeoActionKey,
  LeoActionPreviewDTO,
  LeoPageContext,
} from "@/lib/leo/types";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TimetableConflict } from "@/models/TimetableConflict";
import { TimetableSlot } from "@/models/TimetableSlot";
import { TimetableVersion } from "@/models/TimetableVersion";
import { User } from "@/models/User";

export type LeoActionContext = {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  role: string;
  pageContext: LeoPageContext;
};

type LeoActionPreviewResult = {
  title: string;
  description: string;
  preview: Record<string, unknown>;
  scopeType?: string | null;
  scopeId?: string | null;
};

type LeoActionExecuteResult = {
  output: Record<string, unknown>;
};

type LeoRegisteredAction = {
  key: LeoActionKey;
  category: LeoActionCategory;
  title: string;
  description: string;
  confirmationRequired: boolean;
  canPreview: (ctx: LeoActionContext) => boolean;
  canExecute: (ctx: LeoActionContext) => boolean;
  preview: (
    ctx: LeoActionContext,
    input: Record<string, unknown>
  ) => Promise<LeoActionPreviewResult>;
  execute: (
    ctx: LeoActionContext,
    input: Record<string, unknown>,
    preview: Record<string, unknown>
  ) => Promise<LeoActionExecuteResult>;
};

function stringInput(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function routeForIssue(issue: string | null, fallbackRoute: string | null) {
  const text = issue?.toLowerCase() || "";
  if (text.includes("fee") || text.includes("overdue") || text.includes("invoice")) {
    return "/admin/finance";
  }
  if (text.includes("teacher") || text.includes("assignment")) {
    return "/admin/teachers";
  }
  if (text.includes("student") || text.includes("attendance") || text.includes("risk")) {
    return "/admin/students";
  }
  if (text.includes("timetable") || text.includes("schedule") || text.includes("publish")) {
    return "/admin/classes";
  }
  if (text.includes("setting") || text.includes("leo access")) {
    return "/admin/settings";
  }
  return fallbackRoute || "/admin";
}

function buildNoticeDraft(input: Record<string, unknown>) {
  const topic = stringInput(input, "topic") || stringInput(input, "title") || "School update";
  const audience = stringInput(input, "audience") || "school community";
  const details = stringInput(input, "details") || stringInput(input, "body");

  return [
    `Subject: ${topic}`,
    "",
    `Dear ${audience},`,
    "",
    details ||
      "We would like to share an important update. Please review the information carefully and contact the school office if you need clarification.",
    "",
    "Thank you,",
    "School Administration",
  ].join("\n");
}

function buildParentMessageDraft(input: Record<string, unknown>) {
  const studentName = stringInput(input, "studentName") || "your child";
  const topic = stringInput(input, "topic") || stringInput(input, "title") || "School update";
  const details = stringInput(input, "details") || stringInput(input, "body");

  return [
    `Subject: ${topic}`,
    "",
    "Dear Parent/Guardian,",
    "",
    details ||
      `We would like to share an update about ${studentName}. Please review this information and contact the school if you need any clarification.`,
    "",
    "Kind regards,",
    "School Administration",
  ].join("\n");
}

function objectIdInput(input: Record<string, unknown>, key: string) {
  const value = stringInput(input, key);
  return value && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
}

function labelPerson(user: { name?: string; firstName?: string; lastName?: string; email?: string } | null) {
  if (!user) return "Unknown teacher";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return user.name || fullName || user.email || "Unknown teacher";
}

async function previewTeacherAssignment(ctx: LeoActionContext, input: Record<string, unknown>) {
  const teacherId =
    objectIdInput(input, "teacherId") ||
    (ctx.pageContext.entity?.type === "teacher" && ctx.pageContext.entity.id
      ? mongoose.Types.ObjectId.isValid(ctx.pageContext.entity.id)
        ? new mongoose.Types.ObjectId(ctx.pageContext.entity.id)
        : null
      : null);
  const subjectId = objectIdInput(input, "subjectId");
  const classGroupId = objectIdInput(input, "classGroupId");
  const academicPeriodId = objectIdInput(input, "academicPeriodId");
  const missing = [
    teacherId ? null : "teacherId",
    subjectId ? null : "subjectId",
    classGroupId ? null : "classGroupId",
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    return {
      title: "Teacher assignment preview needs details",
      description: "Leo needs a teacher, subject, and class before it can preview the impact.",
      preview: {
        canApply: false,
        previewOnly: true,
        missingFields: missing,
        guidance:
          "Provide teacherId, subjectId, and classGroupId from the assignment surface to get a conflict-aware preview.",
      },
      scopeType: "teacher_assignment",
      scopeId: "missing_input",
    };
  }

  const period =
    academicPeriodId
      ? await AcademicPeriod.findOne({ _id: academicPeriodId, schoolId: ctx.schoolId }).lean()
      : await AcademicPeriod.findOne({ schoolId: ctx.schoolId, isCurrent: true }).lean();
  const [teacher, subject, classGroup] = await Promise.all([
    Teacher.findOne({ _id: teacherId, schoolId: ctx.schoolId }).lean(),
    Subject.findOne({ _id: subjectId, schoolId: ctx.schoolId }).lean(),
    ClassGroup.findOne({ _id: classGroupId, schoolId: ctx.schoolId }).lean(),
  ]);

  if (!period || !teacher || !subject || !classGroup) {
    return {
      title: "Teacher assignment preview could not resolve records",
      description: "One or more records were not found in this school.",
      preview: {
        canApply: false,
        previewOnly: true,
        missingRecords: {
          teacher: !teacher,
          subject: !subject,
          classGroup: !classGroup,
          academicPeriod: !period,
        },
      },
      scopeType: "teacher_assignment",
      scopeId: teacherId ? String(teacherId) : "unknown",
    };
  }

  const [teacherUser, existingSameTeacherAssignment, coTeachers, teacherAssignmentCount] =
    await Promise.all([
      User.findById(teacher.userId).select("name firstName lastName email").lean(),
      TeacherAssignment.findOne({
        schoolId: ctx.schoolId,
        teacherId,
        subjectId,
        classGroupId,
        academicPeriodId: period._id,
        status: "active",
      }).lean(),
      TeacherAssignment.find({
        schoolId: ctx.schoolId,
        subjectId,
        classGroupId,
        academicPeriodId: period._id,
        status: "active",
        teacherId: { $ne: teacherId },
      })
        .select("teacherId")
        .lean(),
      TeacherAssignment.countDocuments({
        schoolId: ctx.schoolId,
        teacherId,
        academicPeriodId: period._id,
        status: "active",
      }),
    ]);
  const subjectLinkedToClass = (classGroup.subjectIds || []).some(
    (id: Types.ObjectId) => String(id) === String(subjectId)
  );
  const warnings = [
    existingSameTeacherAssignment
      ? "This exact teacher-subject-class assignment already exists for the selected period."
      : null,
    coTeachers.length > 0
      ? "Another active teacher is already assigned to this subject and class. This would be co-teaching."
      : null,
    !subjectLinkedToClass
      ? "This subject is not currently linked to the class group subject list."
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    title: "Preview teacher assignment",
    description: "Leo checked the proposed assignment without changing records.",
    preview: {
      canApply: warnings.length === 0,
      previewOnly: true,
      proposedChange: {
        teacher: labelPerson(teacherUser),
        subject: subject.name,
        classGroup: classGroup.name,
        academicPeriod: `${period.yearLabel} ${period.term}`,
      },
      impact: {
        teacherActiveAssignmentsInPeriod: teacherAssignmentCount,
        coTeacherCount: coTeachers.length,
        subjectLinkedToClass,
      },
      warnings,
    },
    scopeType: "teacher_assignment",
    scopeId: String(teacherId),
  };
}

async function previewHomeroomChange(ctx: LeoActionContext, input: Record<string, unknown>) {
  const teacherId =
    objectIdInput(input, "teacherId") ||
    (ctx.pageContext.entity?.type === "teacher" &&
    ctx.pageContext.entity.id &&
    mongoose.Types.ObjectId.isValid(ctx.pageContext.entity.id)
      ? new mongoose.Types.ObjectId(ctx.pageContext.entity.id)
      : null);
  const classGroupId = objectIdInput(input, "classGroupId");
  const missing = [
    teacherId ? null : "teacherId",
    classGroupId ? null : "classGroupId",
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    return {
      title: "Homeroom preview needs details",
      description: "Leo needs a teacher and class before it can preview the homeroom change.",
      preview: {
        canApply: false,
        previewOnly: true,
        missingFields: missing,
        guidance: "Provide teacherId and classGroupId from the homeroom assignment surface.",
      },
      scopeType: "homeroom",
      scopeId: "missing_input",
    };
  }

  const [teacher, classGroup] = await Promise.all([
    Teacher.findOne({ _id: teacherId, schoolId: ctx.schoolId }).lean(),
    ClassGroup.findOne({ _id: classGroupId, schoolId: ctx.schoolId }).lean(),
  ]);
  if (!teacher || !classGroup) {
    return {
      title: "Homeroom preview could not resolve records",
      description: "One or more records were not found in this school.",
      preview: {
        canApply: false,
        previewOnly: true,
        missingRecords: {
          teacher: !teacher,
          classGroup: !classGroup,
        },
      },
      scopeType: "homeroom",
      scopeId: teacherId ? String(teacherId) : "unknown",
    };
  }

  const [teacherUser, currentClassHomeroom, currentTeacherHomeroom] = await Promise.all([
    User.findById(teacher.userId).select("name firstName lastName email").lean(),
    classGroup.homeroomTeacherId
      ? Teacher.findOne({ _id: classGroup.homeroomTeacherId, schoolId: ctx.schoolId })
          .populate("userId", "name firstName lastName email")
          .lean()
      : null,
    teacher.homeroomClassGroupId
      ? ClassGroup.findOne({ _id: teacher.homeroomClassGroupId, schoolId: ctx.schoolId })
          .select("name")
          .lean()
      : null,
  ]);
  const currentHomeroomUser =
    currentClassHomeroom?.userId &&
    typeof currentClassHomeroom.userId === "object" &&
    "email" in currentClassHomeroom.userId
      ? (currentClassHomeroom.userId as {
          name?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
        })
      : null;
  const sameAssignment =
    classGroup.homeroomTeacherId && String(classGroup.homeroomTeacherId) === String(teacherId);
  const warnings = [
    sameAssignment ? "This teacher is already the homeroom teacher for this class." : null,
    currentClassHomeroom && !sameAssignment
      ? `This class already has ${labelPerson(currentHomeroomUser)} as homeroom teacher.`
      : null,
    teacher.homeroomClassGroupId && String(teacher.homeroomClassGroupId) !== String(classGroupId)
      ? `This teacher is already assigned to homeroom ${currentTeacherHomeroom?.name || "another class"}.`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    title: "Preview homeroom change",
    description: "Leo checked the homeroom change without changing records.",
    preview: {
      canApply: warnings.length === 0,
      previewOnly: true,
      proposedChange: {
        teacher: labelPerson(teacherUser),
        classGroup: classGroup.name,
      },
      impact: {
        classAlreadyHasHomeroom: Boolean(currentClassHomeroom),
        teacherAlreadyHasHomeroom: Boolean(teacher.homeroomClassGroupId),
        wouldReplaceClassHomeroom: Boolean(currentClassHomeroom && !sameAssignment),
        wouldMoveTeacherFromAnotherHomeroom: Boolean(
          teacher.homeroomClassGroupId && String(teacher.homeroomClassGroupId) !== String(classGroupId)
        ),
      },
      warnings,
    },
    scopeType: "homeroom",
    scopeId: String(teacherId),
  };
}

async function previewTimetablePublish(ctx: LeoActionContext, input: Record<string, unknown>) {
  const versionId = objectIdInput(input, "versionId");
  const academicPeriodId = objectIdInput(input, "academicPeriodId");
  const period =
    academicPeriodId
      ? await AcademicPeriod.findOne({ _id: academicPeriodId, schoolId: ctx.schoolId }).lean()
      : await AcademicPeriod.findOne({ schoolId: ctx.schoolId, isCurrent: true }).lean();

  if (!period) {
    return {
      title: "Timetable publish preview needs a period",
      description: "Leo could not find the selected or current academic period.",
      preview: {
        canApply: false,
        previewOnly: true,
        missingRecords: { academicPeriod: true },
      },
      scopeType: "timetable_publish",
      scopeId: "missing_period",
    };
  }

  const draftVersion = versionId
    ? await TimetableVersion.findOne({
        _id: versionId,
        schoolId: ctx.schoolId,
        academicPeriodId: period._id,
      }).lean()
    : await TimetableVersion.findOne({
        schoolId: ctx.schoolId,
        academicPeriodId: period._id,
        status: "draft",
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();
  const publishedVersion = await TimetableVersion.findOne({
    schoolId: ctx.schoolId,
    academicPeriodId: period._id,
    status: "published",
  })
    .sort({ publishedAt: -1, updatedAt: -1 })
    .lean();

  if (!draftVersion) {
    return {
      title: "No draft timetable to publish",
      description: "Leo could not find a draft timetable version to preview.",
      preview: {
        canApply: false,
        previewOnly: true,
        missingRecords: { draftVersion: true },
        academicPeriod: `${period.yearLabel} ${period.term}`,
      },
      scopeType: "timetable_publish",
      scopeId: "missing_draft",
    };
  }

  const [slotCount, missingTeacherCount, openErrorCount, openWarningCount] = await Promise.all([
    TimetableSlot.countDocuments({
      schoolId: ctx.schoolId,
      academicPeriodId: period._id,
      versionId: draftVersion._id,
    }),
    TimetableSlot.countDocuments({
      schoolId: ctx.schoolId,
      academicPeriodId: period._id,
      versionId: draftVersion._id,
      $or: [{ teacherId: null }, { teacherId: { $exists: false } }],
    }),
    TimetableConflict.countDocuments({
      schoolId: ctx.schoolId,
      academicPeriodId: period._id,
      versionId: draftVersion._id,
      status: "open",
      severity: "error",
    }),
    TimetableConflict.countDocuments({
      schoolId: ctx.schoolId,
      academicPeriodId: period._id,
      versionId: draftVersion._id,
      status: "open",
      severity: "warning",
    }),
  ]);
  const warnings = [
    draftVersion.status !== "draft"
      ? `Selected version is ${draftVersion.status}, not draft.`
      : null,
    slotCount === 0 ? "This draft has no timetable slots." : null,
    missingTeacherCount > 0
      ? `${missingTeacherCount} slot(s) do not have a teacher assigned.`
      : null,
    openErrorCount > 0 ? `${openErrorCount} open error conflict(s) must be resolved before publish.` : null,
    openWarningCount > 0 ? `${openWarningCount} open warning conflict(s) should be reviewed.` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    title: "Preview timetable publish",
    description: "Leo checked publish readiness without publishing the timetable.",
    preview: {
      canApply: warnings.length === 0,
      previewOnly: true,
      proposedChange: {
        version: draftVersion.name,
        academicPeriod: `${period.yearLabel} ${period.term}`,
        currentPublishedVersion: publishedVersion?.name || "None",
      },
      impact: {
        slotCount,
        missingTeacherCount,
        openErrorCount,
        openWarningCount,
        wouldReplacePublishedVersion: Boolean(publishedVersion),
      },
      warnings,
    },
    scopeType: "timetable_publish",
    scopeId: String(draftVersion._id),
  };
}

export const LEO_ACTION_REGISTRY: Record<LeoActionKey, LeoRegisteredAction> = {
  navigate_to_fix_surface: {
    key: "navigate_to_fix_surface",
    category: "navigate",
    title: "Navigate to fix surface",
    description: "Open the admin page most likely to help resolve the issue.",
    confirmationRequired: true,
    canPreview: () => true,
    canExecute: () => true,
    async preview(ctx, input) {
      const issue = stringInput(input, "issue") || stringInput(input, "reason");
      const href = stringInput(input, "href") || routeForIssue(issue, ctx.pageContext.route);
      return {
        title: "Open recommended page",
        description: `Leo will take you to ${href}.`,
        preview: {
          href,
          label: "Recommended admin page",
          reason: issue || "Based on the current Leo context.",
        },
        scopeType: "route",
        scopeId: href,
      };
    },
    async execute(_ctx, _input, preview) {
      return {
        output: {
          href: typeof preview.href === "string" ? preview.href : "/admin",
          navigated: true,
        },
      };
    },
  },
  draft_school_notice: {
    key: "draft_school_notice",
    category: "draft",
    title: "Draft school notice",
    description: "Prepare a school notice draft without sending it.",
    confirmationRequired: true,
    canPreview: (ctx) => ctx.role === "school_admin",
    canExecute: (ctx) => ctx.role === "school_admin",
    async preview(_ctx, input) {
      const draftText = buildNoticeDraft(input);
      return {
        title: "Review notice draft",
        description: "Leo will create a reusable notice draft. Nothing will be sent.",
        preview: {
          draftText,
          audience: stringInput(input, "audience") || "school community",
          delivery: "draft_only",
        },
        scopeType: "communication",
        scopeId: "school_notice",
      };
    },
    async execute(_ctx, _input, preview) {
      return {
        output: {
          draftText: typeof preview.draftText === "string" ? preview.draftText : "",
          delivery: "draft_only",
        },
      };
    },
  },
  draft_parent_message: {
    key: "draft_parent_message",
    category: "draft",
    title: "Draft parent message",
    description: "Prepare a parent message draft without sending it.",
    confirmationRequired: true,
    canPreview: (ctx) => ctx.role === "school_admin",
    canExecute: (ctx) => ctx.role === "school_admin",
    async preview(_ctx, input) {
      const draftText = buildParentMessageDraft(input);
      return {
        title: "Review parent message draft",
        description: "Leo will create a parent message draft. Nothing will be sent.",
        preview: {
          draftText,
          audience: "parent_guardian",
          delivery: "draft_only",
          studentName: stringInput(input, "studentName") || null,
        },
        scopeType: "communication",
        scopeId: "parent_message",
      };
    },
    async execute(_ctx, _input, preview) {
      return {
        output: {
          draftText: typeof preview.draftText === "string" ? preview.draftText : "",
          delivery: "draft_only",
        },
      };
    },
  },
  preview_teacher_assignment_change: {
    key: "preview_teacher_assignment_change",
    category: "assign",
    title: "Preview teacher assignment change",
    description: "Preview a teacher assignment change before applying it.",
    confirmationRequired: true,
    canPreview: (ctx) => ctx.role === "school_admin",
    canExecute: (ctx) => ctx.role === "school_admin",
    async preview(ctx, input) {
      return previewTeacherAssignment(ctx, input);
    },
    async execute(_ctx, _input, preview) {
      return {
        output: {
          previewOnly: true,
          notApplied: true,
          reviewed: true,
          proposedChange: preview.proposedChange ?? null,
          warnings: preview.warnings ?? [],
        },
      };
    },
  },
  preview_homeroom_change: {
    key: "preview_homeroom_change",
    category: "assign",
    title: "Preview homeroom change",
    description: "Preview a homeroom change before applying it.",
    confirmationRequired: true,
    canPreview: (ctx) => ctx.role === "school_admin",
    canExecute: (ctx) => ctx.role === "school_admin",
    async preview(ctx, input) {
      return previewHomeroomChange(ctx, input);
    },
    async execute(_ctx, _input, preview) {
      return {
        output: {
          previewOnly: true,
          notApplied: true,
          reviewed: true,
          proposedChange: preview.proposedChange ?? null,
          warnings: preview.warnings ?? [],
        },
      };
    },
  },
  preview_timetable_publish: {
    key: "preview_timetable_publish",
    category: "publish",
    title: "Preview timetable publish",
    description: "Preview timetable publish impact before publishing.",
    confirmationRequired: true,
    canPreview: (ctx) => ctx.role === "school_admin",
    canExecute: (ctx) => ctx.role === "school_admin",
    async preview(ctx, input) {
      return previewTimetablePublish(ctx, input);
    },
    async execute(_ctx, _input, preview) {
      return {
        output: {
          previewOnly: true,
          notApplied: true,
          reviewed: true,
          proposedChange: preview.proposedChange ?? null,
          warnings: preview.warnings ?? [],
        },
      };
    },
  },
};

export function getLeoAction(actionKey: LeoActionKey) {
  return LEO_ACTION_REGISTRY[actionKey];
}

export function serializeLeoActionPreview(
  actionRunId: string,
  actionKey: LeoActionKey,
  result: LeoActionPreviewResult,
  confirmationRequired: boolean
): LeoActionPreviewDTO {
  return {
    actionRunId,
    actionKey,
    title: result.title,
    description: result.description,
    confirmationRequired,
    preview: result.preview,
  };
}

export function serializeLeoActionExecution(
  actionRunId: string,
  actionKey: LeoActionKey,
  result: LeoActionExecuteResult
): LeoActionExecuteDTO {
  return {
    actionRunId,
    actionKey,
    status: "executed",
    output: result.output,
  };
}
