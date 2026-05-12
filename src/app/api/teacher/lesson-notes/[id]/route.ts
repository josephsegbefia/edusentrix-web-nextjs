import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { User } from "@/models/User";
import { LessonNoteReviewComment, type ILessonNoteReviewComment } from "@/models/LessonNoteReviewComment";
import { normalizeLessonNoteRequestBody } from "@/lib/lesson-notes/normalize-payload";
import {
  countOpenReviewComments,
  formatUserDisplayName,
  getLessonNoteReviewSections,
} from "@/lib/lesson-notes/review";
import {
  assertLessonNoteRequiresSchemeLink,
  resolveLessonNoteSchemeFields,
} from "@/lib/lesson-notes/validate-lesson-note-scheme";

// ============================================================================
// Zod Schemas (same as in route.ts, but all optional for PATCH)
// ============================================================================

const ResourceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().max(1000).optional().default(""),
  type: z.string().trim().max(40).optional().nullable(),
});

const CurriculumIndicatorSchema = z.object({
  refNo: z.string().max(50),
  text: z.string().max(500),
});

const CurriculumAlignmentSchema = z.object({
  strand: z.string().max(200).optional(),
  subStrand: z.string().max(200).optional(),
  contentStandard: z.string().max(500).optional(),
  indicators: z.array(CurriculumIndicatorSchema).optional(),
  learningOutcomes: z.array(z.string().max(500)).optional(),
});

const NaCCAStarterSchema = z.object({
  activities: z.string().max(4000).optional(),
  rpkPrompt: z.string().max(2000).optional(),
  engagementHook: z.string().max(2000).optional(),
  timeMins: z.number().min(0).max(60).optional(),
});

const NaCCAMainSchema = z.object({
  teacherActivities: z.string().max(4000).optional(),
  learnerActivities: z.string().max(4000).optional(),
  resourcesUsed: z.string().max(2000).optional(),
  embeddedAssessment: z.string().max(2000).optional(),
  differentiation: z.string().max(2000).optional(),
  groupingStrategy: z.string().max(500).optional(),
  timeMins: z.number().min(0).max(120).optional(),
});

const NaCCAPlenarySchema = z.object({
  summaryPoints: z.string().max(2000).optional(),
  learnerReflection: z.string().max(2000).optional(),
  teacherReflection: z.string().max(2000).optional(),
  exitTicket: z.string().max(1000).optional(),
  homework: z.string().max(2000).optional(),
  timeMins: z.number().min(0).max(30).optional(),
});

const NaCCA3PhaseBodySchema = z.object({
  starter: NaCCAStarterSchema.optional(),
  main: NaCCAMainSchema.optional(),
  plenary: NaCCAPlenarySchema.optional(),
});

const ClassicObjectivesSchema = z.object({
  general: z.string().max(500).optional(),
  specific: z.array(z.string().max(300)).optional(),
});

const ClassicPresentationStepSchema = z.object({
  stepTitle: z.string().max(100).optional(),
  teacherActivity: z.string().max(2000).optional(),
  learnerActivity: z.string().max(2000).optional(),
  boardWork: z.string().max(1000).optional(),
  keyQuestions: z.array(z.string().max(300)).optional(),
  timeMins: z.number().min(0).max(60).optional(),
});

const ClassicEvaluationSchema = z.object({
  questions: z.array(z.string().max(500)).optional(),
  answers: z.array(z.string().max(500)).optional(),
  markingNotes: z.string().max(1000).optional(),
});

const ClassicJHSBodySchema = z.object({
  objectives: ClassicObjectivesSchema.optional(),
  rpk: z.string().max(2000).optional(),
  introduction: z.string().max(2000).optional(),
  presentationSteps: z.array(ClassicPresentationStepSchema).optional(),
  corePoints: z.array(z.string().max(300)).optional(),
  evaluation: ClassicEvaluationSchema.optional(),
  remarks: z.string().max(2000).optional(),
});

const SimpleBodySchema = z.object({
  objectives: z.string().max(2000).optional(),
  content: z.string().max(8000).optional(),
});

const AssessmentSchema = z.object({
  inClassChecks: z.array(z.string().max(500)).optional(),
  exitTicket: z.string().max(1000).optional(),
  homework: z.string().max(2000).optional(),
  rubricId: z.string().optional(),
});

const ReflectionsSchema = z.object({
  learner: z.string().max(2000).optional(),
  teacher: z.string().max(2000).optional(),
  nextLessonLink: z.string().max(500).optional(),
});

const UpdateLessonNoteSchema = z.object({
  classGroupId: z.string().min(1).optional(),
  subjectId: z.string().optional().nullable(),

  // Template type & curriculum
  templateType: z.enum([
    "NACCA_3_PHASE",
    "CLASSIC_JHS",
    "SIMPLE",
    "CAMBRIDGE_3_PART",
    "BRITISH_3_PART",
    "AMERICAN_STANDARDS",
    "IB_PYP_UNIT_PLANNER",
    "IB_MYP_UNIT_PLANNER",
  ]).optional(),
  curriculumCode: z.string().max(50).optional(),
  curriculumMetadata: z.record(z.string(), z.unknown()).optional(),
  unitPlannerData: z.record(z.string(), z.unknown()).optional(),

  // Basic info
  weekOf: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  topic: z.string().min(1).max(200).optional(),
  durationMinutes: z.number().min(5).max(180).optional().nullable(),
  references: z.array(z.string().max(500)).optional(),

  // Curriculum
  curriculum: CurriculumAlignmentSchema.optional().nullable(),

  // TLMs
  tlms: z.array(z.string().max(100)).optional(),

  // Body - stored as Mixed in MongoDB, accept any object structure
  body: z
    .union([
      NaCCA3PhaseBodySchema,
      ClassicJHSBodySchema,
      SimpleBodySchema,
      z.record(z.string(), z.unknown()),
    ])
    .optional()
    .nullable(),

  // Assessment
  assessment: AssessmentSchema.optional().nullable(),

  // Reflections
  reflections: ReflectionsSchema.optional().nullable(),

  // Resources
  resources: z.array(ResourceSchema).optional(),

  // Tags
  tags: z.array(z.string().max(40)).optional(),

  // Status (teachers can only set draft/published, admins can do more)
  status: z.enum(["draft", "submitted", "approved", "rejected", "published"]).optional(),

  // Legacy fields
  objectives: z.string().max(2000).optional().nullable(),
  content: z.string().max(8000).optional().nullable(),

  schemeId: z.string().optional().nullable(),
  schemeItemIds: z.array(z.string()).optional().nullable(),
});

// ============================================================================
// Helpers
// ============================================================================

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function normalizeWeekOf(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
}

function formatLessonNoteResponse(
  entry: ILessonNote,
  className: string,
  subjectName: string | null,
  teacherName: string | null,
  reviewComments: Array<Record<string, unknown>> = []
) {
  return {
    id: String(entry._id),
    schoolId: String(entry.schoolId),
    teacherId: String(entry.teacherId),
    teacherName,
    classGroupId: String(entry.classGroupId),
    className,
    subjectId: entry.subjectId ? String(entry.subjectId) : null,
    subjectName,
    academicPeriodId: entry.academicPeriodId ? String(entry.academicPeriodId) : null,

    // Template & curriculum
    templateType: entry.templateType || "SIMPLE",
    curriculumCode: (entry as unknown as Record<string, unknown>).curriculumCode || null,
    curriculumMetadata: (entry as unknown as Record<string, unknown>).curriculumMetadata || null,
    unitPlannerData: (entry as unknown as Record<string, unknown>).unitPlannerData || null,

    // Basic info
    weekOf: entry.weekOf ? new Date(entry.weekOf).toISOString() : null,
    date: entry.date ? new Date(entry.date).toISOString() : null,
    topic: entry.topic,
    durationMinutes: entry.durationMinutes || null,
    references: entry.references || [],

    // Curriculum
    curriculum: entry.curriculum || null,

    // TLMs
    tlms: entry.tlms || [],

    // Body
    body: entry.body || null,

    // Assessment
    assessment: entry.assessment || null,

    // Reflections
    reflections: entry.reflections || null,

    // Resources
    resources: entry.resources || [],

    // Tags
    tags: entry.tags || [],

    // Status & workflow
    status: entry.status,
    submittedAt: entry.submittedAt ? new Date(entry.submittedAt).toISOString() : null,
    approvedAt: entry.approvedAt ? new Date(entry.approvedAt).toISOString() : null,
    approvedBy: entry.approvedBy ? String(entry.approvedBy) : null,
    rejectionReason: entry.rejectionReason || null,

    // Export
    exportUrls: entry.exportUrls || null,

    // Legacy fields
    objectives: entry.objectives || null,
    content: entry.content || null,

    // Timestamps
    createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
    schemeId: entry.schemeId ? String(entry.schemeId) : null,
    schemeItemIds: (entry.schemeItemIds || []).map((id) => String(id)),
    reviewComments,
    openCommentCount: countOpenReviewComments(reviewComments as never[]),
  };
}

function serializeReviewComments(
  comments: ILessonNoteReviewComment[],
  userMap: Map<
    string,
    { name?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null }
  >
) {
  return comments.map((comment) => ({
    id: String(comment._id),
    lessonNoteId: String(comment.lessonNoteId),
    sectionKey: comment.sectionKey,
    sectionLabel: comment.sectionLabel,
    commentType: comment.commentType,
    comment: comment.comment,
    status: comment.status,
    authorId: String(comment.authorId),
    authorName: formatUserDisplayName(
      userMap.get(String(comment.authorId)),
      "Reviewer"
    ),
    addressedAt: comment.addressedAt ? new Date(comment.addressedAt).toISOString() : null,
    addressedBy: comment.addressedBy ? String(comment.addressedBy) : null,
    addressedByName: comment.addressedBy
      ? formatUserDisplayName(userMap.get(String(comment.addressedBy)), "Teacher")
      : null,
    resolvedAt: comment.resolvedAt ? new Date(comment.resolvedAt).toISOString() : null,
    resolvedBy: comment.resolvedBy ? String(comment.resolvedBy) : null,
    resolvedByName: comment.resolvedBy
      ? formatUserDisplayName(userMap.get(String(comment.resolvedBy)), "Reviewer")
      : null,
    createdAt: new Date(comment.createdAt).toISOString(),
    updatedAt: new Date(comment.updatedAt).toISOString(),
  }));
}

// ============================================================================
// GET - Get single lesson note
// ============================================================================

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const entry = await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    }).lean() as ILessonNote | null;

    if (!entry) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    // Fetch class name
    const classGroup = await ClassGroup.findById(entry.classGroupId)
      .select("name gradeId")
      .lean() as { name: string; gradeId?: mongoose.Types.ObjectId } | null;

    let className = classGroup?.name || "";
    if (classGroup?.gradeId) {
      const grade = await Grade.findById(classGroup.gradeId)
        .select("name")
        .lean() as { name: string } | null;
      if (grade) {
        className = `${grade.name} ${classGroup.name}`.trim();
      }
    }

    // Fetch subject name
    let subjectName: string | null = null;
    if (entry.subjectId) {
      const subject = await Subject.findById(entry.subjectId)
        .select("name")
        .lean() as { name: string } | null;
      subjectName = subject?.name || null;
    }

    const [comments, teacherUser] = await Promise.all([
      LessonNoteReviewComment.find({
        schoolId: context.schoolId,
        lessonNoteId: noteId,
      })
        .sort({ createdAt: -1 })
        .lean() as Promise<ILessonNoteReviewComment[]>,
      User.findById(context.userId)
        .select("_id name firstName lastName email")
        .lean(),
    ]);

    const commentUserIds = Array.from(
      new Set(
        [
          String(context.userId),
          ...comments.map((comment) => String(comment.authorId)),
          ...comments
            .map((comment) => comment.addressedBy)
            .filter(Boolean)
            .map((value) => String(value)),
          ...comments
            .map((comment) => comment.resolvedBy)
            .filter(Boolean)
            .map((value) => String(value)),
        ]
      )
    ).map((value) => new mongoose.Types.ObjectId(value));

    const commentUsers = commentUserIds.length
      ? await User.find({ _id: { $in: commentUserIds } })
          .select("_id name firstName lastName email")
          .lean()
      : [];

    const userMap = new Map(
      commentUsers.map(
        (user: {
          _id: mongoose.Types.ObjectId;
          name?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
        }) => [String(user._id), user]
      )
    );

    return Response.json({
      success: true,
      data: formatLessonNoteResponse(
        entry,
        className,
        subjectName,
        formatUserDisplayName(teacherUser, "Teacher"),
        serializeReviewComments(comments, userMap)
      ),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch lesson note:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch lesson note";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================================
// PATCH - Update lesson note
// ============================================================================

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    const body = normalizeLessonNoteRequestBody(await req.json().catch(() => null));
    const parsed = UpdateLessonNoteSchema.safeParse(body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues?.map((issue) => issue.message).join(", ") || "Invalid data";
      return Response.json(
        { success: false, error: `Validation failed: ${errorMessages}` },
        { status: 400 }
      );
    }

    const existing = await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("classGroupId subjectId status templateType schemeId schemeItemIds")
      .lean() as Pick<
      ILessonNote,
      "classGroupId" | "subjectId" | "status" | "templateType" | "schemeId" | "schemeItemIds"
    > | null;

    if (!existing) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    // Check if note can be edited (not approved/rejected unless admin)
    if (!context.isAdmin && ["approved", "rejected"].includes(existing.status)) {
      return Response.json(
        { success: false, error: "Cannot edit approved or rejected notes" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const unsetData: Record<string, unknown> = {};
    const touchedSectionKeys = new Set<string>();

    let classGroupObjId = existing.classGroupId as mongoose.Types.ObjectId;
    if (parsed.data.classGroupId) {
      const nextClassGroupId = toObjectIdOrNull(parsed.data.classGroupId);
      if (!nextClassGroupId) {
        return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
      }
      classGroupObjId = nextClassGroupId;
      updateData.classGroupId = nextClassGroupId;
    }

    let subjectObjId = existing.subjectId as mongoose.Types.ObjectId | null | undefined;
    if ("subjectId" in parsed.data) {
      if (parsed.data.subjectId) {
        const nextSubjectId = toObjectIdOrNull(parsed.data.subjectId);
        if (!nextSubjectId) {
          return Response.json({ success: false, error: "Invalid subject ID" }, { status: 400 });
        }
        subjectObjId = nextSubjectId;
        updateData.subjectId = nextSubjectId;
      } else {
        subjectObjId = null;
        unsetData.subjectId = "";
      }
    }

    if (!context.isAdmin) {
      const assignmentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        status: "active",
      };
      if (subjectObjId) assignmentQuery.subjectId = subjectObjId;

      const assignment = await TeacherAssignment.findOne(assignmentQuery)
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    if (
      (parsed.data.classGroupId || "subjectId" in parsed.data) &&
      existing.schemeId
    ) {
      const revalidate = await resolveLessonNoteSchemeFields({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        subjectId: subjectObjId,
        schemeId: String(existing.schemeId),
        schemeItemIds: existing.schemeItemIds?.map((id) => String(id)) ?? [],
      });
      if (!revalidate.ok) {
        return Response.json(
          { success: false, error: revalidate.error },
          { status: revalidate.status }
        );
      }
    }

    const touchedScheme =
      "schemeId" in parsed.data || "schemeItemIds" in parsed.data;

    let resolvedScheme: {
      schemeObjectId: mongoose.Types.ObjectId | null;
      schemeItemObjectIds: mongoose.Types.ObjectId[];
    } | null = null;

    if (touchedScheme) {
      const schemeStr =
        parsed.data.schemeId !== undefined
          ? parsed.data.schemeId
          : existing.schemeId
            ? String(existing.schemeId)
            : null;
      const itemStrs =
        parsed.data.schemeItemIds !== undefined
          ? parsed.data.schemeItemIds ?? []
          : existing.schemeItemIds?.map((id) => String(id)) ?? [];

      const schemeResolution = await resolveLessonNoteSchemeFields({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        subjectId: subjectObjId,
        schemeId: schemeStr,
        schemeItemIds: schemeStr ? itemStrs : [],
      });

      if (!schemeResolution.ok) {
        return Response.json(
          { success: false, error: schemeResolution.error },
          { status: schemeResolution.status }
        );
      }
      resolvedScheme = schemeResolution;

      if (!schemeResolution.schemeObjectId) {
        unsetData.schemeId = "";
        unsetData.schemeItemIds = "";
      } else {
        updateData.schemeId = schemeResolution.schemeObjectId;
        updateData.schemeItemIds = schemeResolution.schemeItemObjectIds;
      }
    }

    const nextStatusForPolicy = parsed.data.status ?? existing.status;

    if (!context.isAdmin && parsed.data.status && !["draft", "submitted"].includes(parsed.data.status)) {
      return Response.json(
        {
          success: false,
          error: "Teachers can save drafts or submit lesson notes for admin review.",
        },
        { status: 403 }
      );
    }
    const finalSchemeIdForPolicy: mongoose.Types.ObjectId | null = touchedScheme
      ? resolvedScheme?.schemeObjectId ?? null
      : (existing.schemeId as mongoose.Types.ObjectId | undefined) ?? null;
    const policy = await assertLessonNoteRequiresSchemeLink({
      schoolId: context.schoolId,
      nextStatus: nextStatusForPolicy,
      schemeIdAfter: finalSchemeIdForPolicy,
    });
    if (!policy.ok) {
      return Response.json({ success: false, error: policy.error }, { status: policy.status });
    }

    // Basic fields
    if (parsed.data.templateType) updateData.templateType = parsed.data.templateType;
    if (parsed.data.curriculumCode !== undefined) updateData.curriculumCode = parsed.data.curriculumCode;
    if (parsed.data.curriculumMetadata !== undefined) updateData.curriculumMetadata = parsed.data.curriculumMetadata;
    if (parsed.data.unitPlannerData !== undefined) updateData.unitPlannerData = parsed.data.unitPlannerData;
    if (parsed.data.topic) updateData.topic = parsed.data.topic;
    if (parsed.data.durationMinutes !== undefined) {
      if (parsed.data.durationMinutes === null) {
        unsetData.durationMinutes = "";
      } else {
        updateData.durationMinutes = parsed.data.durationMinutes;
      }
    }
    if ("references" in parsed.data) updateData.references = parsed.data.references;
    if ("tlms" in parsed.data) updateData.tlms = parsed.data.tlms;
    if ("resources" in parsed.data) updateData.resources = parsed.data.resources;
    if ("tags" in parsed.data) updateData.tags = parsed.data.tags;

    if (
      parsed.data.classGroupId ||
      "subjectId" in parsed.data ||
      parsed.data.templateType ||
      parsed.data.curriculumCode !== undefined ||
      parsed.data.topic ||
      parsed.data.durationMinutes !== undefined ||
      "weekOf" in parsed.data ||
      "date" in parsed.data ||
      "references" in parsed.data
    ) {
      touchedSectionKeys.add("context");
    }
    if ("curriculum" in parsed.data || parsed.data.curriculumMetadata !== undefined) {
      touchedSectionKeys.add("curriculum");
    }
    if ("tlms" in parsed.data || "resources" in parsed.data) {
      touchedSectionKeys.add("resources");
    }
    if ("body" in parsed.data) {
      touchedSectionKeys.add("body");
    }
    if ("assessment" in parsed.data) {
      touchedSectionKeys.add("assessment");
    }
    if ("reflections" in parsed.data) {
      touchedSectionKeys.add("reflections");
    }
    if (parsed.data.unitPlannerData !== undefined) {
      for (const section of getLessonNoteReviewSections({
        templateType: existing.templateType || "SIMPLE",
      })) {
        if (!["context", "curriculum", "resources", "body", "assessment", "reflections"].includes(section.key)) {
          touchedSectionKeys.add(section.key);
        }
      }
    }

    // Week of
    if (parsed.data.weekOf) {
      const weekDate = normalizeWeekOf(new Date(parsed.data.weekOf));
      if (Number.isNaN(weekDate.getTime())) {
        return Response.json({ success: false, error: "Invalid week value" }, { status: 400 });
      }
      updateData.weekOf = weekDate;
    }

    // Date
    if ("date" in parsed.data) {
      if (parsed.data.date) {
        const lessonDate = new Date(parsed.data.date);
        if (Number.isNaN(lessonDate.getTime())) {
          return Response.json({ success: false, error: "Invalid date value" }, { status: 400 });
        }
        updateData.date = lessonDate;
      } else {
        unsetData.date = "";
      }
    }

    // Curriculum
    if ("curriculum" in parsed.data) {
      if (parsed.data.curriculum) {
        updateData.curriculum = parsed.data.curriculum;
      } else {
        unsetData.curriculum = "";
      }
    }

    // Body
    if ("body" in parsed.data) {
      if (parsed.data.body) {
        updateData.body = parsed.data.body;
      } else {
        unsetData.body = "";
      }
    }

    // Assessment
    if ("assessment" in parsed.data) {
      if (parsed.data.assessment) {
        updateData.assessment = parsed.data.assessment;
      } else {
        unsetData.assessment = "";
      }
    }

    // Reflections
    if ("reflections" in parsed.data) {
      if (parsed.data.reflections) {
        updateData.reflections = parsed.data.reflections;
      } else {
        unsetData.reflections = "";
      }
    }

    // Status (with restrictions for non-admins)
    if (parsed.data.status) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === "submitted") {
        updateData.submittedAt = new Date();
        unsetData.rejectionReason = "";
      }
    }

    // Legacy fields
    if ("objectives" in parsed.data) {
      if (parsed.data.objectives) {
        updateData.objectives = parsed.data.objectives;
      } else {
        unsetData.objectives = "";
      }
    }

    if ("content" in parsed.data) {
      if (parsed.data.content) {
        updateData.content = parsed.data.content;
      } else {
        unsetData.content = "";
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (Object.keys(updateData).length > 0) {
      updatePayload.$set = updateData;
    }
    if (Object.keys(unsetData).length > 0) {
      updatePayload.$unset = unsetData;
    }

    if (Object.keys(updatePayload).length === 0) {
      return Response.json({ success: true });
    }

    await LessonNote.updateOne({ _id: noteId }, updatePayload);

    if (touchedSectionKeys.size > 0) {
      await LessonNoteReviewComment.updateMany(
        {
          schoolId: context.schoolId,
          lessonNoteId: noteId,
          sectionKey: { $in: Array.from(touchedSectionKeys) },
          status: "open",
        },
        {
          $set: {
            status: "addressed",
            addressedAt: new Date(),
            addressedBy: context.userId,
          },
        }
      );
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update lesson note:", e);
    const message = e instanceof Error ? e.message : "Failed to update lesson note";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Delete lesson note
// ============================================================================

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const noteId = toObjectIdOrNull(id);
    if (!noteId) {
      return Response.json({ success: false, error: "Invalid lesson note ID" }, { status: 400 });
    }

    // Check if note exists and can be deleted
    const existing = await LessonNote.findOne({
      _id: noteId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("status")
      .lean() as Pick<ILessonNote, "status"> | null;

    if (!existing) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    // Prevent deleting approved notes unless admin
    if (!context.isAdmin && existing.status === "approved") {
      return Response.json(
        { success: false, error: "Cannot delete approved notes" },
        { status: 403 }
      );
    }

    const result = await LessonNote.deleteOne({
      _id: noteId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    });

    if (!result.deletedCount) {
      return Response.json({ success: false, error: "Lesson note not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete lesson note:", e);
    const message = e instanceof Error ? e.message : "Failed to delete lesson note";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
