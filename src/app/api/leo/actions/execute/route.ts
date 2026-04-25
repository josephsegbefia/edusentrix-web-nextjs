import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getLeoAction, serializeLeoActionExecution } from "@/lib/leo/action-registry";
import { buildLeoPageContext } from "@/lib/leo/context-builder";
import { writeLeoActionAudit } from "@/lib/leo/audit-writer";
import { requireEnabledSchoolLeo } from "@/lib/leo/require-enabled-school-leo";
import type { LeoActionKey } from "@/lib/leo/types";
import { LeoActionRun } from "@/models/LeoActionRun";

export const dynamic = "force-dynamic";

const ExecuteActionSchema = z.object({
  actionRunId: z.string().min(1),
  confirmed: z.literal(true),
  input: z.record(z.string(), z.unknown()).default({}),
  pageContextSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireEnabledSchoolLeo();
    const body = await req.json().catch(() => ({}));
    const parsed = ExecuteActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }
    if (!mongoose.Types.ObjectId.isValid(parsed.data.actionRunId)) {
      return NextResponse.json({ success: false, error: "Invalid action run id" }, { status: 400 });
    }

    await connectToDatabase();
    const actionRun = await LeoActionRun.findOne({
      _id: new mongoose.Types.ObjectId(parsed.data.actionRunId),
      schoolId: ctx.schoolId,
      actorUserId: ctx.userId,
      status: "previewed",
    });
    if (!actionRun) {
      return NextResponse.json({ success: false, error: "Action preview not found" }, { status: 404 });
    }

    const actionKey = actionRun.actionKey as LeoActionKey;
    const action = getLeoAction(actionKey);
    const pageContext = buildLeoPageContext(parsed.data.pageContextSnapshot ?? null);
    const actionCtx = {
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      role: ctx.role,
      pageContext,
    };

    if (!action.canExecute(actionCtx)) {
      return NextResponse.json(
        { success: false, error: "Leo action is not available for this role yet." },
        { status: 403 }
      );
    }

    try {
      const result = await action.execute(
        actionCtx,
        parsed.data.input,
        actionRun.previewOutput ?? {}
      );
      actionRun.executeInput = {
        input: parsed.data.input,
        pageContext,
      };
      actionRun.executeOutput = result.output;
      actionRun.confirmationState = "confirmed";
      actionRun.status = "executed";

      const audit = await writeLeoActionAudit({
        schoolId: ctx.schoolId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        actionRunId: actionRun._id,
        actionKey,
        route: pageContext.route,
        previewInput: actionRun.previewInput,
        previewOutput: actionRun.previewOutput ?? null,
        executeInput: actionRun.executeInput,
        executeOutput: result.output,
        result: "succeeded",
      });
      actionRun.auditEventId = audit._id;
      await actionRun.save();

      return NextResponse.json({
        success: true,
        data: serializeLeoActionExecution(String(actionRun._id), actionKey, result),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Leo action execution failed";
      actionRun.executeInput = {
        input: parsed.data.input,
        pageContext,
      };
      actionRun.confirmationState = "confirmed";
      actionRun.status = "failed";
      actionRun.errorMessage = message;
      const audit = await writeLeoActionAudit({
        schoolId: ctx.schoolId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        actionRunId: actionRun._id,
        actionKey,
        route: pageContext.route,
        previewInput: actionRun.previewInput,
        previewOutput: actionRun.previewOutput ?? null,
        executeInput: actionRun.executeInput,
        executeOutput: null,
        result: "failed",
        errorMessage: message,
      });
      actionRun.auditEventId = audit._id;
      await actionRun.save();
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo action execute error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to execute Leo action" },
      { status: 500 }
    );
  }
}
