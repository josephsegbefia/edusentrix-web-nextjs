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

const PublishBodySchema = z.object({
  notebookNotesPublished: z.boolean(),
});

function formatNotebookNotesResponse(session: {
  boardNotes?: {
    contentHtml: string;
    generatedAt: Date;
    aiGenerated: boolean;
  } | null;
  notebookNotesPublished?: boolean;
}) {
  return {
    boardNotes: session.boardNotes ?? null,
    notebookNotesPublished: Boolean(session.notebookNotesPublished),
  };
}

/** GET — load notebook notes for the session */
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
      .select("boardNotes notebookNotesPublished")
      .lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    return Response.json({
      success: true,
      data: formatNotebookNotesResponse(session),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[session-board-notes GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load notebook notes";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

/** PUT — save notebook notes on the session */
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
      .select("boardNotes notebookNotesPublished")
      .lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    return Response.json({
      success: true,
      data: formatNotebookNotesResponse(session),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[session-board-notes PUT]", e);
    const message = e instanceof Error ? e.message : "Failed to save notebook notes";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

/** PATCH — publish or unpublish notebook notes for students */
export async function PATCH(
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
    const parsed = PublishBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    if (parsed.data.notebookNotesPublished) {
      const existing = await LessonSession.findOne({
        _id: sessionId,
        schoolId: context.schoolId,
      })
        .select("boardNotes")
        .lean();
      if (!existing?.boardNotes?.contentHtml?.trim()) {
        return Response.json(
          {
            success: false,
            error: "Save notebook notes before sharing them with students.",
          },
          { status: 400 },
        );
      }
    }

    const session = await LessonSession.findOneAndUpdate(
      { _id: sessionId, schoolId: context.schoolId },
      { $set: { notebookNotesPublished: parsed.data.notebookNotesPublished } },
      { new: true },
    )
      .select("boardNotes notebookNotesPublished")
      .lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    return Response.json({
      success: true,
      data: formatNotebookNotesResponse(session),
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[session-board-notes PATCH]", e);
    const message = e instanceof Error ? e.message : "Failed to update notebook notes visibility";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
