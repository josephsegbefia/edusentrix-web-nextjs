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

// ============================================================================
// Zod Schemas (same as in route.ts, but all optional for PATCH)
// ============================================================================

const ResourceSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().min(1).max(1000),
  type: z.string().max(40).optional().nullable(),
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

  // Template type
  templateType: z.enum(["NACCA_3_PHASE", "CLASSIC_JHS", "SIMPLE"]).optional(),

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
  subjectName: string | null
) {
  return {
    id: String(entry._id),
    classGroupId: String(entry.classGroupId),
    className,
    subjectId: entry.subjectId ? String(entry.subjectId) : null,
    subjectName,
    academicPeriodId: entry.academicPeriodId ? String(entry.academicPeriodId) : null,

    // Template
    templateType: entry.templateType || "SIMPLE",

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
  };
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

    return Response.json({
      success: true,
      data: formatLessonNoteResponse(entry, className, subjectName),
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

    const body = await req.json().catch(() => null);
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
      .select("classGroupId subjectId status")
      .lean() as Pick<ILessonNote, "classGroupId" | "subjectId" | "status"> | null;

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

    // Basic fields
    if (parsed.data.templateType) updateData.templateType = parsed.data.templateType;
    if (parsed.data.topic) updateData.topic = parsed.data.topic;
    if (parsed.data.durationMinutes !== undefined) {
      if (parsed.data.durationMinutes === null) {
        unsetData.durationMinutes = "";
      } else {
        updateData.durationMinutes = parsed.data.durationMinutes;
      }
    }
    if (parsed.data.references) updateData.references = parsed.data.references;
    if (parsed.data.tlms) updateData.tlms = parsed.data.tlms;
    if (parsed.data.resources) updateData.resources = parsed.data.resources;
    if (parsed.data.tags) updateData.tags = parsed.data.tags;

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
      if (!context.isAdmin) {
        // Teachers can only set draft or published
        if (!["draft", "published"].includes(parsed.data.status)) {
          return Response.json(
            { success: false, error: "Teachers can only set draft or published status" },
            { status: 403 }
          );
        }
      }
      updateData.status = parsed.data.status;
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
