import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireEnabledSchoolLeo } from "@/lib/leo/require-enabled-school-leo";
import { LeoConversation } from "@/models/LeoConversation";
import { LeoMessage } from "@/models/LeoMessage";

export const dynamic = "force-dynamic";

const PatchConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

function serializeConversation(doc: {
  _id: unknown;
  title: string;
  sourceApp: string;
  sourceRoute?: string | null;
  sourceTab?: string | null;
  pinned: boolean;
  archivedAt?: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(doc._id),
    title: doc.title,
    sourceApp: doc.sourceApp,
    sourceRoute: doc.sourceRoute ?? null,
    sourceTab: doc.sourceTab ?? null,
    pinned: !!doc.pinned,
    archivedAt: doc.archivedAt ? new Date(doc.archivedAt).toISOString() : null,
    lastMessageAt: new Date(doc.lastMessageAt).toISOString(),
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireEnabledSchoolLeo();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid conversation id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = PatchConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const set: Record<string, unknown> = {};
    if (parsed.data.title) set.title = parsed.data.title;
    if (typeof parsed.data.pinned === "boolean") set.pinned = parsed.data.pinned;
    if (typeof parsed.data.archived === "boolean") {
      set.archivedAt = parsed.data.archived ? new Date() : null;
    }

    await connectToDatabase();
    const conversation = await LeoConversation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        schoolId: ctx.schoolId,
        userId: ctx.userId,
      },
      { $set: set },
      { new: true }
    ).lean();

    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: serializeConversation(conversation),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo conversation PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update Leo conversation" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireEnabledSchoolLeo();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid conversation id" }, { status: 400 });
    }

    await connectToDatabase();
    const conversationId = new mongoose.Types.ObjectId(id);
    const conversation = await LeoConversation.findOne({
      _id: conversationId,
      schoolId: ctx.schoolId,
      userId: ctx.userId,
    }).lean();

    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    await Promise.all([
      LeoMessage.deleteMany({
        conversationId,
        schoolId: ctx.schoolId,
        userId: ctx.userId,
      }),
      LeoConversation.deleteOne({
        _id: conversationId,
        schoolId: ctx.schoolId,
        userId: ctx.userId,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo conversation DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete Leo conversation" },
      { status: 500 }
    );
  }
}
