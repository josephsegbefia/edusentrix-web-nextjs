import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import {
  LessonDeliveryReflection,
  type ILessonDeliveryReflection,
} from "@/models/LessonDeliveryReflection";
import { gateLessonsFeature, gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { loadLessonSessionForTeacher } from "@/lib/lessons/load-lesson-session";
import type {
  LessonDeliveryReflectionDto,
  TeacherSessionReflectionResponse,
} from "@/types/lesson-reflection";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const UpsertBodySchema = z.object({
  completed: z.boolean().optional(),
  objectivesMet: z.enum(["yes", "partially", "no"]).optional(),
  notes: z.string().trim().max(8000).optional().nullable(),
  studentsWhoStruggled: z.array(z.string().trim().max(160)).max(60).optional(),
  followUpRequired: z.boolean().optional(),
  followUpNotes: z.string().trim().max(4000).optional().nullable(),
  nextStep: z.string().trim().max(2000).optional().nullable(),
});

function formatReflection(r: ILessonDeliveryReflection): LessonDeliveryReflectionDto {
  return {
    id: String(r._id),
    deliveryId: String(r.deliveryId),
    sessionId: String(r.sessionId),
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const moduleGate = await gateLessonsModule(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const reflectionGate = gateLessonsFeature(
      moduleGate.settings,
      "enableLessonReflection",
      "Lesson reflection",
    );
    if (!reflectionGate.ok) {
      return Response.json(
        { success: false, error: reflectionGate.error },
        { status: reflectionGate.status },
      );
    }

    if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const loaded = await loadLessonSessionForTeacher({
      sessionId: sessionOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
    });
    if (loaded.kind === "not_found") {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (loaded.kind === "forbidden") {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!loaded.delivery) {
      return Response.json({ success: false, error: "Delivery not found" }, { status: 404 });
    }

    const doc = (await LessonDeliveryReflection.findOne({
      schoolId: context.schoolId,
      deliveryId: loaded.delivery._id,
    }).lean()) as ILessonDeliveryReflection | null;

    const body: TeacherSessionReflectionResponse = {
      success: true,
      data: { reflection: doc ? formatReflection(doc) : null },
    };
    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions reflection GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load reflection";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const moduleGate = await gateLessonsModule(context.schoolId);
    if (!moduleGate.ok) {
      return Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status });
    }
    const reflectionGate = gateLessonsFeature(
      moduleGate.settings,
      "enableLessonReflection",
      "Lesson reflection",
    );
    if (!reflectionGate.ok) {
      return Response.json(
        { success: false, error: reflectionGate.error },
        { status: reflectionGate.status },
      );
    }

    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const loaded = await loadLessonSessionForTeacher({
      sessionId: sessionOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
    });
    if (loaded.kind === "not_found") {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (loaded.kind === "forbidden") {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!loaded.delivery) {
      return Response.json({ success: false, error: "Delivery not found" }, { status: 404 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = UpsertBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const update: Record<string, unknown> = { teacherId: context.teacherId };
    if (parsed.data.completed !== undefined) update.completed = parsed.data.completed;
    if (parsed.data.objectivesMet !== undefined) update.objectivesMet = parsed.data.objectivesMet;
    if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
    if (parsed.data.studentsWhoStruggled !== undefined) {
      update.studentsWhoStruggled = parsed.data.studentsWhoStruggled;
    }
    if (parsed.data.followUpRequired !== undefined) update.followUpRequired = parsed.data.followUpRequired;
    if (parsed.data.followUpNotes !== undefined) update.followUpNotes = parsed.data.followUpNotes;
    if (parsed.data.nextStep !== undefined) update.nextStep = parsed.data.nextStep;

    const doc = (await LessonDeliveryReflection.findOneAndUpdate(
      { schoolId: context.schoolId, deliveryId: loaded.delivery._id },
      {
        $set: update,
        $setOnInsert: {
          schoolId: context.schoolId,
          deliveryId: loaded.delivery._id,
          sessionId: loaded.session._id,
        },
      },
      { upsert: true, new: true },
    ).lean()) as ILessonDeliveryReflection;

    const body: TeacherSessionReflectionResponse = {
      success: true,
      data: { reflection: formatReflection(doc) },
    };
    return Response.json(body);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions reflection PATCH]", e);
    const message = e instanceof Error ? e.message : "Failed to save reflection";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
