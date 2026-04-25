import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getLeoAction, serializeLeoActionPreview } from "@/lib/leo/action-registry";
import { buildLeoPageContext } from "@/lib/leo/context-builder";
import { requireEnabledSchoolLeo } from "@/lib/leo/require-enabled-school-leo";
import type { LeoActionKey } from "@/lib/leo/types";
import { LeoActionRun } from "@/models/LeoActionRun";
import { LeoConversation } from "@/models/LeoConversation";

export const dynamic = "force-dynamic";

const PreviewActionSchema = z.object({
  actionKey: z.enum([
    "navigate_to_fix_surface",
    "draft_school_notice",
    "draft_parent_message",
    "preview_teacher_assignment_change",
    "preview_homeroom_change",
    "preview_timetable_publish",
  ]),
  input: z.record(z.string(), z.unknown()).default({}),
  conversationId: z.string().nullable().optional(),
  messageId: z.string().nullable().optional(),
  pageContextSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
});

function toObjectId(value?: string | null) {
  if (!value) return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireEnabledSchoolLeo();
    const body = await req.json().catch(() => ({}));
    const parsed = PreviewActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const actionKey = parsed.data.actionKey as LeoActionKey;
    const action = getLeoAction(actionKey);
    const pageContext = buildLeoPageContext(parsed.data.pageContextSnapshot ?? null);
    const actionCtx = {
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      role: ctx.role,
      pageContext,
    };

    if (!action.canPreview(actionCtx)) {
      return NextResponse.json(
        { success: false, error: "Leo action is not available for this role yet." },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const conversationId = toObjectId(parsed.data.conversationId);
    if (parsed.data.conversationId && !conversationId) {
      return NextResponse.json({ success: false, error: "Invalid conversation id" }, { status: 400 });
    }
    if (conversationId) {
      const conversation = await LeoConversation.exists({
        _id: conversationId,
        schoolId: ctx.schoolId,
        userId: ctx.userId,
        archivedAt: null,
      });
      if (!conversation) {
        return NextResponse.json(
          { success: false, error: "Conversation not found" },
          { status: 404 }
        );
      }
    }

    const preview = await action.preview(actionCtx, parsed.data.input);
    const actionRun = await LeoActionRun.create({
      schoolId: ctx.schoolId,
      conversationId,
      messageId: toObjectId(parsed.data.messageId),
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      actionKey,
      scopeType: preview.scopeType ?? null,
      scopeId: preview.scopeId ?? null,
      previewInput: {
        input: parsed.data.input,
        pageContext,
      },
      previewOutput: preview.preview,
      confirmationState: action.confirmationRequired ? "pending" : "not_required",
      status: "previewed",
    });

    return NextResponse.json({
      success: true,
      data: serializeLeoActionPreview(
        String(actionRun._id),
        actionKey,
        preview,
        action.confirmationRequired
      ),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo action preview error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to preview Leo action" },
      { status: 500 }
    );
  }
}
