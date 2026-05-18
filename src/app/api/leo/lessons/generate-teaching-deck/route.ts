import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireLessonsLeoTeacherContext } from "@/lib/leo/lessons-draft-shared";
import { LessonSession } from "@/models/LessonSession";
import { buildTeachingDeckFromSession } from "@/lib/lessons/build-teaching-deck";
import { loadLessonSessionForTeacher } from "@/lib/lessons/load-lesson-session";

const BodySchema = z.object({
  sessionId: z.string().min(1),
});

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/** Rebuild teaching deck slides from current session content (Leo-gated like other lesson tools). */
export async function POST(req: Request) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    await connectToDatabase();

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues?.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const sessionOid = toObjectId(parsed.data.sessionId);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const loaded = await loadLessonSessionForTeacher({
      sessionId: sessionOid,
      schoolId: ctx.schoolId,
      teacherId: ctx.teacherId,
      isAdmin: ctx.isAdmin,
    });
    if (loaded.kind === "not_found") {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (loaded.kind === "forbidden") {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const session = await LessonSession.findById(loaded.session._id);
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    session.teachingDeck = buildTeachingDeckFromSession(session);
    await session.save();

    return Response.json({
      success: true,
      data: {
        slideCount: session.teachingDeck?.slides?.length ?? 0,
        teachingDeck: session.teachingDeck,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[leo/lessons/generate-teaching-deck]", e);
    const message = e instanceof Error ? e.message : "Failed to build teaching deck";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
