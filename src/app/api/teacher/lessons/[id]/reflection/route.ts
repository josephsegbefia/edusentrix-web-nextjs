import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { Lesson, type ILesson } from "@/models/Lesson";
import { LessonReflection, type ILessonReflection } from "@/models/LessonReflection";
import type { LessonReflectionDto, TeacherLessonReflectionResponse } from "@/types/lesson-reflection";

const UpsertBodySchema = z.object({
  completed: z.boolean().optional(),
  objectivesMet: z.enum(["yes", "partially", "no"]).optional(),
  notes: z.string().trim().max(8000).optional().nullable(),
  studentsWhoStruggled: z.array(z.string().trim().max(160)).max(60).optional(),
  followUpRequired: z.boolean().optional(),
  followUpNotes: z.string().trim().max(4000).optional().nullable(),
  nextStep: z.string().trim().max(2000).optional().nullable(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function formatReflection(r: ILessonReflection): LessonReflectionDto {
  return {
    id: String(r._id),
    lessonId: String(r.lessonId),
    completed: r.completed,
    objectivesMet: r.objectivesMet,
    notes: r.notes ?? null,
    studentsWhoStruggled: r.studentsWhoStruggled || [],
    followUpRequired: r.followUpRequired,
    followUpNotes: r.followUpNotes ?? null,
    nextStep: r.nextStep ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
  };
}

async function loadLessonOwned(
  lessonId: mongoose.Types.ObjectId,
  schoolId: mongoose.Types.ObjectId,
  teacherId: mongoose.Types.ObjectId
) {
  return Lesson.findOne({
    _id: lessonId,
    schoolId,
    teacherId,
  })
    .select("_id")
    .lean() as Promise<Pick<ILesson, "_id"> | null>;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = await loadLessonOwned(lessonId, context.schoolId, context.teacherId);
    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const doc = (await LessonReflection.findOne({
      schoolId: context.schoolId,
      lessonId,
    }).lean()) as ILessonReflection | null;

    const body: TeacherLessonReflectionResponse = {
      success: true,
      data: { reflection: doc ? formatReflection(doc) : null },
    };
    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load lesson reflection:", e);
    const message = e instanceof Error ? e.message : "Failed to load reflection";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.journalWrite)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const lessonId = toObjectIdOrNull(id);
    if (!lessonId) {
      return Response.json({ success: false, error: "Invalid lesson ID" }, { status: 400 });
    }

    const lesson = await loadLessonOwned(lessonId, context.schoolId, context.teacherId);
    if (!lesson) {
      return Response.json({ success: false, error: "Lesson not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = UpsertBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }

    const existing = (await LessonReflection.findOne({
      schoolId: context.schoolId,
      lessonId,
    }).lean()) as ILessonReflection | null;

    const p = parsed.data;
    const struggled = p.studentsWhoStruggled?.map((s) => s.trim()).filter(Boolean) ?? undefined;

    const partial: Record<string, unknown> = {};
    if (p.completed !== undefined) partial.completed = p.completed;
    if (p.objectivesMet !== undefined) partial.objectivesMet = p.objectivesMet;
    if (p.notes !== undefined) partial.notes = p.notes?.trim() || undefined;
    if (struggled !== undefined) partial.studentsWhoStruggled = struggled;
    if (p.followUpRequired !== undefined) partial.followUpRequired = p.followUpRequired;
    if (p.followUpNotes !== undefined) partial.followUpNotes = p.followUpNotes?.trim() || undefined;
    if (p.nextStep !== undefined) partial.nextStep = p.nextStep?.trim() || undefined;

    if (existing) {
      if (Object.keys(partial).length === 0) {
        return Response.json({
          success: true,
          data: { reflection: formatReflection(existing) },
        });
      }
      await LessonReflection.updateOne({ _id: existing._id }, { $set: partial });
      const next = (await LessonReflection.findById(existing._id).lean()) as ILessonReflection;
      return Response.json({
        success: true,
        data: { reflection: formatReflection(next) },
      });
    }

    const created = await LessonReflection.create({
      schoolId: context.schoolId,
      lessonId,
      teacherId: context.teacherId,
      completed: p.completed ?? false,
      objectivesMet: p.objectivesMet ?? "partially",
      notes: p.notes?.trim() || undefined,
      studentsWhoStruggled: struggled ?? [],
      followUpRequired: p.followUpRequired ?? false,
      followUpNotes: p.followUpNotes?.trim() || undefined,
      nextStep: p.nextStep?.trim() || undefined,
    });

    return Response.json({
      success: true,
      data: { reflection: formatReflection(created.toObject() as ILessonReflection) },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to save lesson reflection:", e);
    const message = e instanceof Error ? e.message : "Failed to save reflection";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
