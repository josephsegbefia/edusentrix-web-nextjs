import "server-only";

import mongoose, { Types } from "mongoose";
import OpenAI from "openai";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { EntitlementError, requireEntitlement } from "@/lib/billing/require-entitlement";
import { trackUsage } from "@/lib/billing/trackUsage";
import { runExamSessionConflictCheck } from "@/lib/exams/exam-conflict-service";
import { getExamSessionPublishReadiness } from "@/lib/exams/exam-readiness-service";
import { ExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import type {
  ExamConflictDTO,
  ExamConflictType,
  ExamLeoConflictExplainDTO,
  ExamLeoInvigilatorSuggestionsDTO,
  ExamLeoParentMessageDraftDTO,
  ExamLeoScheduleImprovementsDTO,
} from "@/types/academics/exam-scheduling-engine";

const CONFLICT_TYPE_LABELS: Record<ExamConflictType, string> = {
  class_overlap: "Class conflict",
  teacher_overlap: "Invigilator conflict",
  room_overlap: "Venue conflict",
  outside_session_range: "Outside session dates",
  missing_invigilator: "Missing invigilator",
  missing_venue: "Missing venue",
  invalid_duration: "Invalid duration",
};

function formatExamConflictType(type: ExamConflictType) {
  return CONFLICT_TYPE_LABELS[type] ?? "Scheduling issue";
}

export const EXAM_SCHEDULING_LEO_DISCLAIMER =
  "Leo suggestions are advisory only. Admins must confirm timetable changes, invigilator assignments, overrides, and publishing.";

const BASE_SYSTEM = `You are Leo, an exam scheduling advisor inside EduSentrix School OS.
Rules:
- Return valid JSON only, with no markdown fences.
- Suggestions are advisory only. Do not publish, override conflicts, or assign staff directly.
- Use only teachers, entries, and conflicts provided in the context.
- Be practical for Ghanaian schools when relevant, but stay grounded in provided data.`;

export async function requireExamSchedulingLeoContext() {
  const auth = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    await requireEntitlement({
      schoolId: auth.schoolId,
      featureKey: "ai_leo_copilot",
      limitKey: "maxAICallsPerMonth",
      expensive: true,
    });
  } catch (error: unknown) {
    if (error instanceof EntitlementError) {
      throw new ExamSchedulingLeoError(error.message, error.statusCode);
    }
    throw error;
  }

  return auth;
}

export class ExamSchedulingLeoError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamSchedulingLeoError";
    this.status = status;
  }
}

async function loadSession(input: { schoolId: Types.ObjectId; sessionId: string }) {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamSchedulingLeoError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  }).lean();

  if (!session) {
    throw new ExamSchedulingLeoError("Exam session not found.", 404);
  }

  return session;
}

export async function buildExamSessionAdvisoryContext(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
}) {
  const session = await loadSession(input);
  const [entries, conflictCheck, readiness] = await Promise.all([
    ExamTimetableEntry.find({
      schoolId: input.schoolId,
      examSessionId: session._id,
    })
      .select("_id title subjectId classGroupIds date startTime endTime isUnscheduled status venueId")
      .lean(),
    runExamSessionConflictCheck({
      schoolId: input.schoolId,
      actorId: input.actorId,
      sessionId: input.sessionId,
    }),
    getExamSessionPublishReadiness({
      schoolId: input.schoolId,
      actorId: input.actorId,
      sessionId: input.sessionId,
    }),
  ]);

  return {
    session: {
      id: String(session._id),
      name: session.name,
      status: session.status,
      startDate: session.startDate.toISOString(),
      endDate: session.endDate.toISOString(),
    },
    entries: entries.map((entry) => ({
      id: String(entry._id),
      title: entry.title,
      subjectId: String(entry.subjectId),
      classGroupIds: entry.classGroupIds.map(String),
      date: entry.date.toISOString(),
      startTime: entry.startTime,
      endTime: entry.endTime,
      isUnscheduled: entry.isUnscheduled,
      status: entry.status,
      venueId: entry.venueId ? String(entry.venueId) : null,
    })),
    conflicts: conflictCheck.conflicts,
    readinessSummary: readiness.summary,
  };
}

async function runExamSchedulingLeoJson(input: {
  schoolId: Types.ObjectId;
  systemInstruction: string;
  userPrompt: string;
  maxTokens?: number;
}) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false as const, error: "AI service not configured" };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TIMETABLE_COACH_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: `${BASE_SYSTEM}\n\n${input.systemInstruction}` },
        { role: "user", content: input.userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
      max_tokens: input.maxTokens ?? 1800,
    });
  } catch (error: unknown) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "OpenAI request failed",
    };
  }

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) return { ok: false as const, error: "Empty AI response" };

  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch {
    return { ok: false as const, error: "Invalid JSON from AI" };
  }

  await trackUsage({
    schoolId: input.schoolId,
    provider: "openai",
    metricKey: "ai_calls",
    quantity: 1,
    unitLabel: "calls",
    allocationMethod: "direct",
    sourceType: "manual",
    notes: "Leo exam scheduling advisory.",
  });

  return { ok: true as const, data };
}

function fallbackConflictExplain(conflict: ExamConflictDTO): ExamLeoConflictExplainDTO {
  return {
    disclaimer: EXAM_SCHEDULING_LEO_DISCLAIMER,
    explanation: conflict.message,
    likelyCauses: [formatExamConflictType(conflict.type)],
    suggestedFixes: conflict.suggestion
      ? [conflict.suggestion]
      : ["Review the affected papers in conflict review."],
  };
}

const conflictExplainSchema = z.object({
  explanation: z.string(),
  likelyCauses: z.array(z.string()).default([]),
  suggestedFixes: z.array(z.string()).default([]),
});

export async function explainExamConflictWithLeo(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  conflictKey: string;
}): Promise<ExamLeoConflictExplainDTO> {
  const context = await buildExamSessionAdvisoryContext(input);
  const conflict = context.conflicts.find((row) => row.key === input.conflictKey);
  if (!conflict) {
    throw new ExamSchedulingLeoError("Conflict not found in the current review.", 404);
  }

  const ai = await runExamSchedulingLeoJson({
    schoolId: input.schoolId,
    systemInstruction:
      "Explain the conflict in plain language for a school admin. Return JSON: { explanation, likelyCauses[], suggestedFixes[] }.",
    userPrompt: JSON.stringify({
      session: context.session,
      conflict,
      relatedEntries: context.entries.filter((entry) =>
        conflict.affectedEntryIds.includes(entry.id)
      ),
    }),
  });

  if (!ai.ok) return fallbackConflictExplain(conflict);

  const parsed = conflictExplainSchema.safeParse(ai.data);
  if (!parsed.success) return fallbackConflictExplain(conflict);

  return {
    disclaimer: EXAM_SCHEDULING_LEO_DISCLAIMER,
    ...parsed.data,
  };
}

const improvementsSchema = z.object({
  summary: z.string(),
  proposals: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        rationale: z.string(),
        affectedEntryIds: z.array(z.string()).default([]),
      })
    )
    .default([]),
});

export async function suggestExamScheduleImprovementsWithLeo(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
}): Promise<ExamLeoScheduleImprovementsDTO> {
  const context = await buildExamSessionAdvisoryContext(input);
  const unscheduled = context.entries.filter((entry) => entry.isUnscheduled);
  const openErrors = context.conflicts.filter(
    (row) => row.severity === "error" && !row.isOverridden
  );

  const fallback: ExamLeoScheduleImprovementsDTO = {
    disclaimer: EXAM_SCHEDULING_LEO_DISCLAIMER,
    summary:
      openErrors.length > 0
        ? `Resolve ${openErrors.length} blocking conflict(s) before publishing.`
        : unscheduled.length > 0
          ? `${unscheduled.length} paper(s) still need dates and times.`
          : "Timetable looks structurally ready. Review warnings and invigilation coverage next.",
    proposals: openErrors.slice(0, 3).map((conflict) => ({
      title: formatExamConflictType(conflict.type),
      description: conflict.message,
      rationale: conflict.suggestion ?? "Resolve this before publishing.",
      affectedEntryIds: conflict.affectedEntryIds,
    })),
  };

  const ai = await runExamSchedulingLeoJson({
    schoolId: input.schoolId,
    systemInstruction:
      "Suggest practical schedule improvements. Do not invent entries. Return JSON: { summary, proposals: [{ title, description, rationale, affectedEntryIds[] }] }.",
    userPrompt: JSON.stringify({
      session: context.session,
      readinessSummary: context.readinessSummary,
      unscheduledCount: unscheduled.length,
      openConflicts: context.conflicts.filter((row) => !row.isOverridden).slice(0, 8),
      entries: context.entries.slice(0, 40),
    }),
  });

  if (!ai.ok) return fallback;
  const parsed = improvementsSchema.safeParse(ai.data);
  if (!parsed.success) return fallback;

  return {
    disclaimer: EXAM_SCHEDULING_LEO_DISCLAIMER,
    ...parsed.data,
  };
}

const parentMessageSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export async function draftExamParentMessageWithLeo(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
}): Promise<ExamLeoParentMessageDraftDTO> {
  const context = await buildExamSessionAdvisoryContext(input);
  const publishedEntries = context.entries.filter((entry) => entry.status === "published");

  const fallback: ExamLeoParentMessageDraftDTO = {
    disclaimer: EXAM_SCHEDULING_LEO_DISCLAIMER,
    subject: `${context.session.name} timetable update`,
    body: `Dear parents and guardians,\n\nPlease note that the ${context.session.name} exam timetable has been published. Kindly review the dates and times with your ward and ensure they arrive on time for each paper.\n\nThank you.`,
  };

  const ai = await runExamSchedulingLeoJson({
    schoolId: input.schoolId,
    systemInstruction:
      "Draft a concise parent notice about a published exam timetable. Return JSON: { subject, body }. Do not include exact times unless provided.",
    userPrompt: JSON.stringify({
      session: context.session,
      publishedPaperCount: publishedEntries.length,
      sampleEntries: publishedEntries.slice(0, 12),
    }),
  });

  if (!ai.ok) return fallback;
  const parsed = parentMessageSchema.safeParse(ai.data);
  if (!parsed.success) return fallback;

  return {
    disclaimer: EXAM_SCHEDULING_LEO_DISCLAIMER,
    ...parsed.data,
  };
}

const invigilatorSchema = z.object({
  summary: z.string(),
  candidates: z
    .array(
      z.object({
        teacherId: z.string(),
        teacherName: z.string().nullable().optional(),
        rationale: z.string(),
        workloadNote: z.string(),
      })
    )
    .default([]),
});

export async function suggestExamInvigilatorReplacementsWithLeo(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  assignmentId: string;
}): Promise<ExamLeoInvigilatorSuggestionsDTO> {
  if (!mongoose.Types.ObjectId.isValid(input.assignmentId)) {
    throw new ExamSchedulingLeoError("Invalid invigilator assignment id.", 400);
  }

  const assignment = await ExamInvigilatorAssignment.findOne({
    _id: input.assignmentId,
    schoolId: input.schoolId,
    examSessionId: input.sessionId,
  }).lean();

  if (!assignment) {
    throw new ExamSchedulingLeoError("Invigilator assignment not found.", 404);
  }

  const [entry, workloadRows, teachers] = await Promise.all([
    ExamTimetableEntry.findOne({
      _id: assignment.examTimetableEntryId,
      schoolId: input.schoolId,
    }).lean(),
    ExamInvigilatorAssignment.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          schoolId: input.schoolId,
          examSessionId: new Types.ObjectId(input.sessionId),
          status: { $in: ["assigned", "acknowledged"] },
        },
      },
      { $group: { _id: "$teacherId", count: { $sum: 1 } } },
    ]),
    Teacher.find({ schoolId: input.schoolId, status: "active" })
      .select("_id userId")
      .limit(40)
      .lean(),
  ]);

  const workloadMap = new Map(workloadRows.map((row) => [String(row._id), row.count]));
  const userIds = teachers.map((teacher) => teacher.userId).filter(Boolean) as Types.ObjectId[];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("_id firstName lastName").lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  const teacherOptions = teachers
    .filter((teacher) => String(teacher._id) !== String(assignment.teacherId))
    .map((teacher) => {
      const user = teacher.userId ? userMap.get(String(teacher.userId)) : null;
      const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : null;
      const count = workloadMap.get(String(teacher._id)) ?? 0;
      return {
        teacherId: String(teacher._id),
        teacherName: name,
        assignmentCount: count,
      };
    })
    .sort((a, b) => a.assignmentCount - b.assignmentCount)
    .slice(0, 6);

  const fallback: ExamLeoInvigilatorSuggestionsDTO = {
    disclaimer: EXAM_SCHEDULING_LEO_DISCLAIMER,
    summary: "Consider teachers with lighter invigilation load for this paper.",
    candidates: teacherOptions.slice(0, 3).map((teacher) => ({
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      rationale: "Lower current invigilation load in this exam session.",
      workloadNote: `${teacher.assignmentCount} active assignment(s) in this session.`,
    })),
  };

  const ai = await runExamSchedulingLeoJson({
    schoolId: input.schoolId,
    systemInstruction:
      "Suggest replacement invigilators from the provided teacher list only. Return JSON: { summary, candidates: [{ teacherId, teacherName, rationale, workloadNote }] }.",
    userPrompt: JSON.stringify({
      currentAssignment: {
        assignmentId: String(assignment._id),
        teacherId: String(assignment.teacherId),
        role: assignment.role,
      },
      entry: entry
        ? {
            id: String(entry._id),
            date: entry.date.toISOString(),
            startTime: entry.startTime,
            endTime: entry.endTime,
          }
        : null,
      teacherOptions,
    }),
  });

  if (!ai.ok) return fallback;
  const parsed = invigilatorSchema.safeParse(ai.data);
  if (!parsed.success) return fallback;

  const allowedIds = new Set(teacherOptions.map((teacher) => teacher.teacherId));
  return {
    disclaimer: EXAM_SCHEDULING_LEO_DISCLAIMER,
    summary: parsed.data.summary,
    candidates: parsed.data.candidates.filter((candidate) => allowedIds.has(candidate.teacherId)),
  };
}
