import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonSession } from "@/models/LessonSession";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";

function toObjectIdOrNull(id: string | null | undefined) {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const SaveBodySchema = z.object({
  contentHtml: z.string().min(1).max(40_000),
  aiGenerated: z.boolean().default(true),
});

/** GET — load existing board notes for the session */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }
    const session = await LessonSession.findOne({
      _id: sessionId,
      schoolId: context.schoolId,
    })
      .select("boardNotes")
      .lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    return Response.json({
      success: true,
      data: {
        boardNotes: session.boardNotes ?? null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[session-board-notes GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load board notes";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

/** PUT — save board notes on the session */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }
    const raw = await req.json().catch(() => null);
    const parsed = SaveBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }
    const session = await LessonSession.findOneAndUpdate(
      { _id: sessionId, schoolId: context.schoolId },
      {
        $set: {
          boardNotes: {
            contentHtml: parsed.data.contentHtml,
            generatedAt: new Date(),
            aiGenerated: parsed.data.aiGenerated,
          },
        },
      },
      { new: true },
    )
      .select("boardNotes")
      .lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    return Response.json({
      success: true,
      data: { boardNotes: session.boardNotes },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[session-board-notes PUT]", e);
    const message = e instanceof Error ? e.message : "Failed to save board notes";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
