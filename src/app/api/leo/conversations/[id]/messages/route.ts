import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireEnabledSchoolLeo } from "@/lib/leo/require-enabled-school-leo";
import { draftLeoAssistantResponse } from "@/lib/leo/orchestrator";
import { LeoConversation } from "@/models/LeoConversation";
import { LeoMessage } from "@/models/LeoMessage";

export const dynamic = "force-dynamic";

const CreateMessageSchema = z.object({
  contentText: z.string().trim().min(1).max(4000),
  pageContextSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
});

function serializeMessage(doc: {
  _id: unknown;
  conversationId: unknown;
  author: string;
  contentText: string;
  citations?: unknown[];
  status: string;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(doc._id),
    conversationId: String(doc.conversationId),
    author: doc.author,
    contentText: doc.contentText,
    citations: doc.citations || [],
    status: doc.status,
    errorMessage: doc.errorMessage ?? null,
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function GET(
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
    const conversation = await LeoConversation.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      archivedAt: null,
    }).lean();

    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    const messages = await LeoMessage.find({
      conversationId: conversation._id,
      schoolId: ctx.schoolId,
      userId: ctx.userId,
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      data: messages.map(serializeMessage),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo messages GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Leo messages" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const parsed = CreateMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const conversation = await LeoConversation.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      archivedAt: null,
    });

    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    const now = new Date();
    const assistantDraft = await draftLeoAssistantResponse({
      schoolId: ctx.schoolId,
      role: ctx.role,
      userMessage: parsed.data.contentText,
      pageContextSnapshot: parsed.data.pageContextSnapshot ?? null,
    });

    const [userMessage, assistantMessage] = await LeoMessage.create([
      {
        conversationId: conversation._id,
        schoolId: ctx.schoolId,
        userId: ctx.userId,
        role: ctx.role,
        author: "user",
        contentText: parsed.data.contentText,
        pageContextSnapshot: parsed.data.pageContextSnapshot ?? null,
        status: "complete",
      },
      {
        conversationId: conversation._id,
        schoolId: ctx.schoolId,
        userId: ctx.userId,
        role: ctx.role,
        author: "assistant",
        contentText: assistantDraft.contentText,
        citations: assistantDraft.citations,
        toolCalls: assistantDraft.toolsUsed.map((toolKey) => ({
          toolKey,
          status: "success",
        })),
        status: "complete",
      },
    ]);

    const set: Record<string, unknown> = { lastMessageAt: now };
    if (conversation.title === "New Leo chat") {
      set.title = parsed.data.contentText.slice(0, 80);
    }
    await LeoConversation.updateOne({ _id: conversation._id }, { $set: set });

    return NextResponse.json(
      {
        success: true,
        data: {
          messages: [userMessage.toObject(), assistantMessage.toObject()].map(serializeMessage),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo messages POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send Leo message" },
      { status: 500 }
    );
  }
}
