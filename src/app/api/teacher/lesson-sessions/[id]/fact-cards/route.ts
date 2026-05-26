import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonSession } from "@/models/LessonSession";
import { LearnFactCard } from "@/models/LearnFactCard";
import { canManageLessonSessionContent } from "@/lib/lessons/session-access";
import { assertLessonsModuleEnabled } from "@/lib/lessons/settings";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const CreateFactCardSchema = z.object({
  fact: z.string().trim().min(1).max(500),
  detail: z.string().trim().min(1).max(2000),
  tags: z.array(z.string().trim().max(60)).max(5).default([]),
});

const BulkFactCardsSchema = z.object({
  cards: z
    .array(
      z.object({
        fact: z.string().trim().min(1).max(500),
        detail: z.string().trim().min(1).max(2000),
        tags: z.array(z.string().trim().max(60)).max(5).default([]),
      }),
    )
    .min(1)
    .max(10),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await assertLessonsModuleEnabled(context.schoolId);
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
    const session = await LessonSession.findOne({ _id: sessionId, schoolId: context.schoolId }).lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    const cards = await LearnFactCard.find({
      schoolId: context.schoolId,
      sessionId,
    })
      .sort({ createdAt: 1 })
      .lean();
    return Response.json({
      success: true,
      data: {
        cards: cards.map((c) => ({
          id: String(c._id),
          fact: c.fact,
          detail: c.detail,
          tags: c.tags ?? [],
          status: c.status,
          publishedToLearn: c.publishedToLearn,
          publishedAt: c.publishedAt?.toISOString() ?? null,
          createdAt: c.createdAt?.toISOString() ?? null,
        })),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions fact-cards GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load fact cards";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await assertLessonsModuleEnabled(context.schoolId);
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
    const session = await LessonSession.findOne({ _id: sessionId, schoolId: context.schoolId }).lean();
    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (
      !canManageLessonSessionContent({
        session,
        teacherId: context.teacherId,
        isAdmin: context.isAdmin,
      })
    ) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);

    // Bulk create
    const bulkParsed = BulkFactCardsSchema.safeParse(raw);
    if (bulkParsed.success) {
      const created = await LearnFactCard.insertMany(
        bulkParsed.data.cards.map((c) => ({
          schoolId: context.schoolId,
          sessionId,
          classGroupId: session.classGroupId,
          subjectOfferingId: session.subjectOfferingId,
          teacherId: context.teacherId,
          fact: c.fact,
          detail: c.detail,
          tags: c.tags,
          status: "published",
          publishedToLearn: true,
          publishedAt: new Date(),
        })),
      );
      return Response.json({ success: true, data: { ids: created.map((c) => String(c._id)) } });
    }

    // Single create
    const parsed = CreateFactCardSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid data";
      return Response.json({ success: false, error: `Validation failed: ${msg}` }, { status: 400 });
    }
    const created = await LearnFactCard.create({
      schoolId: context.schoolId,
      sessionId,
      classGroupId: session.classGroupId,
      subjectOfferingId: session.subjectOfferingId,
      teacherId: context.teacherId,
      fact: parsed.data.fact,
      detail: parsed.data.detail,
      tags: parsed.data.tags,
      status: "published",
      publishedToLearn: true,
      publishedAt: new Date(),
    });
    return Response.json({ success: true, data: { id: String(created._id) } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions fact-cards POST]", e);
    const message = e instanceof Error ? e.message : "Failed to save fact card";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const sessionId = toObjectIdOrNull(id);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }
    const url = new URL(req.url);
    const cardId = url.searchParams.get("cardId");
    if (!cardId) {
      return Response.json({ success: false, error: "cardId required" }, { status: 400 });
    }
    const cardOid = toObjectIdOrNull(cardId);
    if (!cardOid) {
      return Response.json({ success: false, error: "Invalid card ID" }, { status: 400 });
    }
    await LearnFactCard.deleteOne({
      _id: cardOid,
      schoolId: context.schoolId,
      sessionId,
      teacherId: context.teacherId,
    });
    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions fact-cards DELETE]", e);
    const message = e instanceof Error ? e.message : "Failed to delete fact card";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
