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
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { normalizeLessonNoteRequestBody } from "@/lib/lesson-notes/normalize-payload";

// ============================================================================
// Zod Schemas
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
}).passthrough();

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

// Main create schema (supports both legacy and new fields)
const LessonNoteSchema = z.object({
  classGroupId: z.string().min(1),
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
  weekOf: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  topic: z.string().min(1).max(200),
  durationMinutes: z.number().min(5).max(180).optional().nullable(),
  references: z.array(z.string().max(500)).optional(),

  // Curriculum
  curriculum: CurriculumAlignmentSchema.optional(),

  // TLMs
  tlms: z.array(z.string().max(100)).optional(),

  // Body - stored as Mixed in MongoDB, accept any object structure
  // The frontend handles validation by template type
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
  assessment: AssessmentSchema.optional(),

  // Reflections
  reflections: ReflectionsSchema.optional(),

  // Resources
  resources: z.array(ResourceSchema).optional(),

  // Tags
  tags: z.array(z.string().max(40)).optional(),

  // Status
  status: z.enum(["draft", "submitted", "approved", "rejected", "published"]).default("draft"),

  // Legacy fields (for backwards compatibility)
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
  classNameMap: Map<string, string>,
  subjectMap: Map<string, string>
) {
  return {
    id: String(entry._id),
    classGroupId: String(entry.classGroupId),
    className: classNameMap.get(String(entry.classGroupId)) || "",
    subjectId: entry.subjectId ? String(entry.subjectId) : null,
    subjectName: entry.subjectId ? subjectMap.get(String(entry.subjectId)) || "" : null,
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
  };
}

// ============================================================================
// GET - List lesson notes
// ============================================================================

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const classGroupId = searchParams.get("classGroupId");
    const subjectId = searchParams.get("subjectId");
    const templateType = searchParams.get("templateType");
    const status = searchParams.get("status");
    const weekOf = searchParams.get("weekOf");
    const academicPeriodId = searchParams.get("academicPeriodId");
    const search = searchParams.get("search");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(Number(limitParam), 1) : 50;

    let classGroupObjId: mongoose.Types.ObjectId | null = null;
    if (classGroupId) {
      classGroupObjId = toObjectIdOrNull(classGroupId);
      if (!classGroupObjId) {
        return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
      }
      if (!context.isAdmin) {
        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          classGroupId: classGroupObjId,
          status: "active",
        })
          .select("_id")
          .lean();
        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    let subjectObjId: mongoose.Types.ObjectId | null = null;
    if (subjectId) {
      subjectObjId = toObjectIdOrNull(subjectId);
      if (!subjectObjId) {
        return Response.json({ success: false, error: "Invalid subject ID" }, { status: 400 });
      }
      if (!context.isAdmin) {
        const assignment = await TeacherAssignment.findOne({
          schoolId: context.schoolId,
          teacherId: context.teacherId,
          subjectId: subjectObjId,
          status: "active",
        })
          .select("_id")
          .lean();
        if (!assignment) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
    }

    let academicPeriodObjId: mongoose.Types.ObjectId | null = null;
    if (academicPeriodId) {
      academicPeriodObjId = toObjectIdOrNull(academicPeriodId);
      if (!academicPeriodObjId) {
        return Response.json({ success: false, error: "Invalid academic period ID" }, { status: 400 });
      }
    }

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (classGroupObjId) query.classGroupId = classGroupObjId;
    if (subjectObjId) query.subjectId = subjectObjId;
    if (academicPeriodObjId) query.academicPeriodId = academicPeriodObjId;
    if (templateType) query.templateType = templateType;
    if (status) query.status = status;

    if (weekOf) {
      const weekDate = normalizeWeekOf(new Date(weekOf));
      if (Number.isNaN(weekDate.getTime())) {
        return Response.json({ success: false, error: "Invalid week value" }, { status: 400 });
      }
      query.weekOf = weekDate;
    }

    if (search) {
      query.$or = [
        { topic: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const entries = await LessonNote.find(query)
      .sort({ weekOf: -1, createdAt: -1 })
      .limit(limit)
      .lean() as ILessonNote[];

    if (entries.length === 0) {
      return Response.json({ success: true, data: { entries: [] } });
    }

    // Fetch related data for display
    const classGroupIds = Array.from(
      new Set(entries.map((entry) => String(entry.classGroupId)))
    ).map((id) => new mongoose.Types.ObjectId(id));

    const subjectIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.subjectId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const [classGroups, subjects] = await Promise.all([
      ClassGroup.find({ _id: { $in: classGroupIds } })
        .select("_id name gradeId")
        .lean(),
      subjectIds.length
        ? Subject.find({ _id: { $in: subjectIds } }).select("_id name").lean()
        : Promise.resolve([]),
    ]);

    const gradeIds = Array.from(
      new Set(
        classGroups
          .map((group: { gradeId?: mongoose.Types.ObjectId }) => group.gradeId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const grades = gradeIds.length
      ? await Grade.find({ _id: { $in: gradeIds } }).select("_id name").lean()
      : [];

    const gradeMap = new Map(
      grades.map((grade: { _id: mongoose.Types.ObjectId; name: string }) => [
        String(grade._id),
        grade.name,
      ])
    );

    const classNameMap = new Map(
      classGroups.map(
        (group: { _id: mongoose.Types.ObjectId; name: string; gradeId?: mongoose.Types.ObjectId }) => {
          const gradeName = group.gradeId ? gradeMap.get(String(group.gradeId)) : undefined;
          const label = `${gradeName ? gradeName + " " : ""}${group.name}`.trim();
          return [String(group._id), label || group.name];
        }
      )
    );

    const subjectMap = new Map(
      subjects.map((subject: { _id: mongoose.Types.ObjectId; name: string }) => [
        String(subject._id),
        subject.name,
      ])
    );

    const data = entries.map((entry) =>
      formatLessonNoteResponse(entry, classNameMap, subjectMap)
    );

    return Response.json({ success: true, data: { entries: data } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch lesson notes:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch lesson notes";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================================
// POST - Create lesson note
// ============================================================================

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = normalizeLessonNoteRequestBody(await req.json().catch(() => null));
    
    // Debug logging - remove in production
    console.log("[LessonNote POST] Received body:", JSON.stringify({
      templateType: body?.templateType,
      hasBody: !!body?.body,
      bodyKeys: body?.body ? Object.keys(body.body) : null,
      hasCurriculum: !!body?.curriculum,
    }));
    
    const parsed = LessonNoteSchema.safeParse(body);
    if (!parsed.success) {
      // Safely extract error messages for Zod v4 compatibility
      const errorMessages = parsed.error.issues?.map((issue) => issue.message).join(", ") || "Invalid data";
      console.error("[LessonNote POST] Validation errors:", errorMessages);
      return Response.json(
        { success: false, error: `Validation failed: ${errorMessages}` },
        { status: 400 }
      );
    }
    
    // Debug logging - remove in production
    console.log("[LessonNote POST] Parsed data:", JSON.stringify({
      templateType: parsed.data.templateType,
      hasBody: !!parsed.data.body,
      bodyKeys: parsed.data.body ? Object.keys(parsed.data.body) : null,
    }));

    const {
      classGroupId,
      subjectId,
      templateType,
      curriculumCode,
      curriculumMetadata,
      unitPlannerData,
      weekOf,
      date,
      topic,
      durationMinutes,
      references,
      curriculum,
      tlms,
      body: noteBody,
      assessment,
      reflections,
      resources,
      tags,
      status,
      // Legacy fields
      objectives,
      content,
    } = parsed.data;

    const classGroupObjId = toObjectIdOrNull(classGroupId);
    if (!classGroupObjId) {
      return Response.json({ success: false, error: "Invalid class group ID" }, { status: 400 });
    }

    let subjectObjId: mongoose.Types.ObjectId | null = null;
    if (subjectId) {
      subjectObjId = toObjectIdOrNull(subjectId);
      if (!subjectObjId) {
        return Response.json({ success: false, error: "Invalid subject ID" }, { status: 400 });
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

    const weekDate = normalizeWeekOf(new Date(weekOf));
    if (Number.isNaN(weekDate.getTime())) {
      return Response.json({ success: false, error: "Invalid week value" }, { status: 400 });
    }

    let lessonDate: Date | undefined;
    if (date) {
      lessonDate = new Date(date);
      if (Number.isNaN(lessonDate.getTime())) {
        return Response.json({ success: false, error: "Invalid date value" }, { status: 400 });
      }
    }

    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    // Determine template type
    const finalTemplateType = templateType || "SIMPLE";

    // Build body based on template type or use legacy fields
    let finalBody = noteBody;
    if (!finalBody && (content || objectives)) {
      // Legacy mode: create simple body from content/objectives
      finalBody = {
        objectives: objectives || "",
        content: content || "",
      };
    }

    // For legacy compatibility, extract content from body if needed
    let legacyContent = content || "";
    let legacyObjectives = objectives || "";
    
    // If body exists and we don't have legacy content, extract from body
    if (finalBody && !content) {
      if ("content" in finalBody && typeof finalBody.content === "string") {
        legacyContent = finalBody.content;
      } else if ("starter" in finalBody) {
        // For NaCCA template, use starter activities as content summary
        legacyContent = "See structured lesson body";
      } else if ("presentationSteps" in finalBody) {
        // For Classic JHS, use first step as content summary
        legacyContent = "See structured lesson body";
      }
    }
    
    if (finalBody && !objectives) {
      if ("objectives" in finalBody && typeof finalBody.objectives === "string") {
        legacyObjectives = finalBody.objectives;
      } else if ("objectives" in finalBody && typeof finalBody.objectives === "object" && finalBody.objectives) {
        const objsObj = finalBody.objectives as { general?: string; specific?: string[] };
        legacyObjectives = objsObj.general || "";
      }
    }

    const created = await LessonNote.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      classGroupId: classGroupObjId,
      subjectId: subjectObjId || undefined,
      academicPeriodId: currentPeriod?._id || undefined,

      // Template & curriculum
      templateType: finalTemplateType,
      curriculumCode: curriculumCode || undefined,
      curriculumMetadata: curriculumMetadata || undefined,
      unitPlannerData: unitPlannerData || undefined,

      // Basic info
      weekOf: weekDate,
      date: lessonDate,
      topic,
      durationMinutes: durationMinutes || undefined,
      references: references || [],

      // Curriculum
      curriculum: curriculum || undefined,

      // TLMs
      tlms: tlms || [],

      // Body
      body: finalBody || undefined,

      // Assessment
      assessment: assessment || undefined,

      // Reflections
      reflections: reflections || undefined,

      // Resources
      resources: resources || [],

      // Tags
      tags: tags || [],

      // Status
      status: status || "draft",

      // Legacy fields (for backwards compatibility) - always provide a value
      objectives: legacyObjectives,
      content: legacyContent || topic, // Use topic as fallback content
    });

    return Response.json({
      success: true,
      data: { id: String(created._id) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create lesson note:", e);
    const message = e instanceof Error ? e.message : "Failed to create lesson note";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
